'use client';

// Copy to your app as `components/bug-reporter/bug-reporter-widget.tsx`,
// then mount <BugReporterWidget /> once in your authenticated layout.
//
// Capture engine (keep verbatim — these are the load-bearing parts):
//   - html2canvas VIEWPORT capture (fast; full-page is slow), JPEG compressed
//     under MAX_SCREENSHOT_SIZE_BYTES so the request fits Vercel's body limit.
//   - console logs harvested from the log-capture module.
//   - SIGNED-URL handshake: POST /api/bug-reports returns upload tokens; the
//     browser uploads the image bytes DIRECTLY to Storage (never in the body).
//
// Deps: html2canvas, react-hot-toast, lucide-react, shadcn/ui (button, textarea,
// card, badge, tooltip), @/lib/supabase/client, @/lib/utils/file-converters,
// @/lib/utils/enhanced-logger. The marketing/reward UI from the original was
// intentionally removed — add your own incentive copy if you want it.

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Bug, X, Camera, Zap, AlertCircle, Lightbulb, HelpCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { getLogManager, initializeLogCapture, logger } from '@/lib/utils/enhanced-logger';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { dataURLtoFile } from '@/lib/utils/file-converters';
import toast from 'react-hot-toast';

if (typeof window !== 'undefined') initializeLogCapture();

const BUCKET = 'bug-reports';
const MAX_SCREENSHOT_WIDTH = 1920;
const MAX_SCREENSHOT_HEIGHT = 2500;
const MAX_SCREENSHOT_SIZE_BYTES = 2 * 1024 * 1024; // leave room under the 4.5MB body limit
const JPEG_QUALITY = 0.75;

const VALID_CATEGORIES = ['question', 'feature_request', 'bug'] as const;
type Category = (typeof VALID_CATEGORIES)[number];
const CATEGORY_STORAGE_KEY = 'bug-reporter:last-category';

function isMobileDevice(): boolean {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768 && 'ontouchstart' in window)
  );
}

// Serialize console args, breaking circular refs and DOM nodes.
function safeStringify(obj: any, maxDepth = 3): any {
  const seen = new WeakSet();
  function walk(value: any, depth = 0): any {
    if (depth > maxDepth) return '[Max Depth Exceeded]';
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular Reference]';
    seen.add(value);
    if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1));
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = ['target', 'currentTarget', 'srcElement'].includes(k) ? '[DOM Element]' : walk(v, depth + 1);
    }
    return out;
  }
  return JSON.parse(JSON.stringify(obj, (_k, v) => walk(v)));
}
function serializeConsoleArgs(args: any[]): any[] {
  return args.map((a) => {
    try {
      return safeStringify(a);
    } catch (e) {
      return `[Serialization Error: ${e instanceof Error ? e.message : 'unknown'}]`;
    }
  });
}

// Resize + JPEG-compress until under the size cap.
async function compressScreenshot(dataUrl: string, maxBytes = MAX_SCREENSHOT_SIZE_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > MAX_SCREENSHOT_WIDTH) {
          height = Math.round(height * (MAX_SCREENSHOT_WIDTH / width));
          width = MAX_SCREENSHOT_WIDTH;
        }
        if (height > MAX_SCREENSHOT_HEIGHT) {
          width = Math.round(width * (MAX_SCREENSHOT_HEIGHT / height));
          height = MAX_SCREENSHOT_HEIGHT;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        let quality = JPEG_QUALITY;
        let result = canvas.toDataURL('image/jpeg', quality);
        while (result.length > maxBytes && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        if (result.length > maxBytes) {
          const f = Math.sqrt(maxBytes / result.length);
          canvas.width = Math.round(width * f);
          canvas.height = Math.round(height * f);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', 0.5);
        }
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}

// Capture the VISIBLE viewport. Ignores the widget itself + radix portals/toasts.
async function capturePageScreenshot(): Promise<string> {
  const isMobile = isMobileDevice();
  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  const ignore = (el: Element) =>
    el.classList.contains('bug-reporter-widget') ||
    el.hasAttribute('data-radix-portal') ||
    el.hasAttribute('data-sonner-toaster') ||
    el.hasAttribute('data-html2canvas-ignore');
  try {
    const canvas = await html2canvas(document.body, {
      scale: isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5),
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: false,
      removeContainer: true,
      logging: false,
      imageTimeout: isMobile ? 5000 : 10000,
      windowWidth: w,
      windowHeight: h,
      width: w,
      height: h,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      foreignObjectRendering: false,
      ignoreElements: ignore,
      onclone: (doc: Document) => {
        ['[data-radix-portal]', '[data-sonner-toaster]', '[role="dialog"]', '.bug-reporter-widget'].forEach((s) => {
          try { doc.querySelectorAll(s).forEach((el) => el.remove()); } catch {}
        });
        if (doc.body) {
          doc.body.style.overflow = 'visible';
          doc.body.style.position = 'static';
        }
      },
    });
    return await compressScreenshot(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
  } catch (e) {
    logger.error('bug-reports', 'html2canvas capture failed', e);
    throw new Error('Screenshot capture failed');
  }
}

export function BugReporterWidget() {
  const [isClient, setIsClient] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('bug');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState('');
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
    try {
      const saved = localStorage.getItem(CATEGORY_STORAGE_KEY);
      if (saved && VALID_CATEGORIES.includes(saved as Category)) setCategory(saved);
    } catch {}
  }, []);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (isOpen) {
      const y = window.scrollY;
      document.body.style.cssText = `overflow:hidden;position:fixed;top:-${y}px;width:100%`;
    } else {
      const top = document.body.style.top;
      document.body.style.cssText = '';
      if (top) window.scrollTo(0, parseInt(top || '0') * -1);
    }
    return () => { document.body.style.cssText = ''; };
  }, [isOpen]);

  const setCat = (v: string) => {
    setCategory(v);
    try { localStorage.setItem(CATEGORY_STORAGE_KEY, v); } catch {}
  };

  // Capture BEFORE the modal is in the DOM, then open it.
  const handleOpen = async () => {
    setScreenshot('');
    setIsCapturing(true);
    try {
      const shot = await capturePageScreenshot();
      setScreenshot(shot);
      toast.success('Screenshot captured!');
    } catch {
      toast.error('Could not auto-capture. You can add one manually.');
    } finally {
      setIsCapturing(false);
      setIsOpen(true);
    }
  };

  const handleRetake = async () => {
    setIsCapturing(true);
    setIsOpen(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      setScreenshot(await capturePageScreenshot());
      toast.success('Screenshot retaken!');
    } catch {
      toast.error('Could not retake. Try manual upload.');
    } finally {
      setIsOpen(true);
      setIsCapturing(false);
    }
  };

  const fileToCompressedDataUrl = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return compressScreenshot(dataUrl);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file.');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image too large (max 5MB).');
    setIsCapturing(true);
    try {
      setScreenshot(await fileToCompressedDataUrl(file));
      toast.success('Image uploaded!');
    } catch {
      toast.error('Failed to upload image.');
    } finally {
      setIsCapturing(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleMultiFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const allowedDocs = new Set([
      'application/pdf', 'text/csv', 'text/plain', 'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ]);
    const remaining = 5 - additionalImages.length;
    if (files.length > remaining) return toast.error(`You can add ${remaining} more file(s) (max 5).`);
    setIsCapturing(true);
    try {
      const processed: string[] = [];
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        if (!isImage && !allowedDocs.has(file.type)) {
          toast.error(`"${file.name}" type not supported. Skipping.`);
          continue;
        }
        const cap = isImage ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > cap) {
          toast.error(`"${file.name}" too large. Skipping.`);
          continue;
        }
        if (isImage) {
          processed.push(await fileToCompressedDataUrl(file));
        } else {
          // Pass docs through untouched — compression corrupts non-image bytes.
          processed.push(await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }));
        }
      }
      if (processed.length) {
        setAdditionalImages((prev) => [...prev, ...processed]);
        toast.success(`${processed.length} file(s) added!`);
      }
    } finally {
      setIsCapturing(false);
      if (e.target) e.target.value = '';
    }
  };

  const mimeToExt = (mime: string): string =>
    ({
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
      'image/webp': 'webp', 'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'text/csv': 'csv',
      'text/plain': 'txt', 'application/json': 'json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
    }[mime] ?? 'bin');

  const handleSubmit = async () => {
    if (description.trim().length < 10) return toast.error('Description must be at least 10 characters.');
    if (!screenshot && !window.confirm('No screenshot attached. Submit anyway?')) return;

    setIsSubmitting(true);
    try {
      const logManager = getLogManager();
      const structured = logManager.getStructuredLogs();
      const safeLogs = serializeConsoleArgs(
        structured.allLogs.map((l: any) => ({
          type: l.type, message: l.message, count: l.count, firstSeen: l.firstSeen, lastSeen: l.lastSeen,
        }))
      );
      const screenshotFmt = screenshot
        ? screenshot.startsWith('data:image/jpeg') ? 'jpg' : 'png'
        : undefined;

      const payload = {
        page_url: window.location.href,
        description: description.trim(),
        category,
        console_logs: safeLogs,
        log_summary: structured.summary,
        metadata: {
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          screenResolution: `${screen.width}x${screen.height}`,
          devicePixelRatio: window.devicePixelRatio,
          timestamp: new Date().toISOString(),
          additionalImagesCount: additionalImages.length,
        },
        wants_screenshot: !!screenshot,
        screenshot_format: screenshotFmt,
        additional_image_count: additionalImages.length,
        additional_image_formats: additionalImages.map((img) =>
          img.startsWith('data:image/jpeg') ? 'jpg' : 'png'
        ),
      };

      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to create bug report.');
      }
      const result = await res.json();

      // Browser-direct uploads via the returned signed URLs.
      const supabase = createClientSupabaseClient();
      if (screenshot && result.signedUploadUrl) {
        const ext = screenshot.startsWith('data:image/jpeg') ? 'jpg' : 'png';
        const file = dataURLtoFile(screenshot, `screenshot.${ext}`);
        await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(result.signedUploadUrl.path, result.signedUploadUrl.token, file, {
            contentType: file.type,
          });
      }
      if (additionalImages.length && result.additionalSignedUrls?.length) {
        await Promise.allSettled(
          additionalImages.slice(0, result.additionalSignedUrls.length).map(async (dataUrl, i) => {
            const signed = result.additionalSignedUrls[i];
            if (!signed) return;
            const mime = dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? 'image/png';
            const file = dataURLtoFile(dataUrl, `additional-${i + 1}.${mimeToExt(mime)}`);
            await supabase.storage
              .from(BUCKET)
              .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
          })
        );
      }

      toast.success(result.message || 'Thank you for reporting this!');
      setDescription('');
      setScreenshot('');
      setAdditionalImages([]);
      setIsOpen(false);
      logManager.clear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isClient) return null;

  const categories: { value: Category; label: string; hint: string; icon: typeof Bug; color: string }[] = [
    { value: 'question', label: 'Question', hint: 'I need help understanding something', icon: HelpCircle, color: 'teal' },
    { value: 'feature_request', label: 'Feature suggestion', hint: 'I have an idea for improvement', icon: Lightbulb, color: 'blue' },
    { value: 'bug', label: 'Bug', hint: 'Something is not working', icon: AlertCircle, color: 'red' },
  ];

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
      <input
        ref={multiFileInputRef}
        type="file"
        accept="image/*,application/pdf,.csv,.xlsx,.xls,.docx,.doc,.txt,.json"
        multiple
        onChange={handleMultiFileSelect}
        style={{ display: 'none' }}
      />

      {/* Floating trigger. z high enough to sit above sheets/drawers. */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleOpen}
              disabled={isCapturing}
              className={`fixed ${isMobileDevice() ? 'bottom-[8.5rem] right-4' : 'bottom-4 right-4'} z-[95] bg-red-600 hover:bg-red-700 rounded-full w-12 h-12 p-0 shadow-lg bug-reporter-widget`}
              variant="outline"
            >
              {isCapturing ? <Camera className="w-5 h-5 animate-pulse" /> : <Bug className="w-5 h-5 text-white" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Report a bug</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-red-600" /> Report an issue
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset>
                <legend className="text-sm font-medium mb-2">What is this about? *</legend>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  {categories.map(({ value, label, hint, icon: Icon, color }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all flex-1 ${
                        category === value
                          ? `border-${color}-500 bg-${color}-50 dark:bg-${color}-950/20`
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="bug-reporter-category"
                        value={value}
                        checked={category === value}
                        onChange={() => setCat(value)}
                        className="sr-only"
                      />
                      <Icon className={`w-5 h-5 shrink-0 ${category === value ? `text-${color}-500` : 'text-muted-foreground'}`} />
                      <div>
                        <p className="text-sm font-medium leading-none">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="text-sm font-medium">
                  {category === 'question' ? 'Your question *' : category === 'feature_request' ? 'Describe your idea *' : 'Describe the issue *'}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What went wrong? Please provide as much detail as possible..."
                  className="mt-1"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum 10 characters required</p>
              </div>

              {screenshot ? (
                <div>
                  <label className="text-sm font-medium text-green-600 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Screenshot captured
                  </label>
                  <div className="mt-1 border rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screenshot} alt="Captured screenshot" className="w-full h-20 object-cover object-top" />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={handleRetake} disabled={isCapturing} className="text-xs">
                      <Camera className="w-3 h-3 mr-1" /> Retake
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isCapturing} className="text-xs">
                      <Camera className="w-3 h-3 mr-1" /> Browse File
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setScreenshot('')} className="text-xs text-destructive">
                      <X className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                  <Camera className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No screenshot captured</p>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isCapturing} className="text-xs">
                    <Camera className="w-3 h-3 mr-1" /> Browse Image File
                  </Button>
                </div>
              )}

              <div>
                <label className="text-sm font-medium flex items-center justify-between">
                  <span className="text-muted-foreground">Additional Attachments (Optional)</span>
                  <span className="text-xs text-muted-foreground">{additionalImages.length}/5 files</span>
                </label>
                {additionalImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {additionalImages.map((image, i) => (
                      <div key={i} className="relative border rounded overflow-hidden group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt={`Attachment ${i + 1}`} className="w-full h-24 object-cover" />
                        <button
                          type="button"
                          onClick={() => setAdditionalImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
                          aria-label="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {additionalImages.length < 5 && (
                  <Button variant="outline" size="sm" onClick={() => multiFileInputRef.current?.click()} disabled={isCapturing} className="text-xs mt-2">
                    <Camera className="w-3 h-3 mr-1" /> Add Attachments
                  </Button>
                )}
              </div>

              <Button onClick={handleSubmit} disabled={isSubmitting || description.trim().length < 10} className="w-full">
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
