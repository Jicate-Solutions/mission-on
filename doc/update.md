Authentication & Routing Update Requirements
1. Remove Google Authentication
Remove the "Sign in with Google" (OAuth) button from all login interfaces across the apps.
Strip out or disable the associated backend Google Auth endpoints and callbacks to ensure the entry point is completely closed.
2. Set Up Super Admin Login
Create a dedicated Super Admin Login flow. This should require standard, secure credentials (username/email and password) rather than an access code.
Place this either on a separate secure route (e.g., /admin-login) or as a hidden toggle/link on the main login screen.
3. Implement Code-Based Access & Dynamic Routing
Replace the standard user login interface with a single Access Code input field.
Role Mapping: Each user role must be tied to specific, unique access codes generated in the database.
Conditional Routing: When a user inputs an access code, the system must:
Validate the code against the database.
Identify the specific role mapped to that code.
Automatically redirect the user to the designated dashboard for their role immediately upon successful validation.
4. Security & State Management Requirements
Ensure the session state firmly locks the user into the permissions of the role mapped to their code, preventing them from navigating to a different dashboard via URL manipulation.
The Super Admin dashboard must include an interface to generate, assign, and revoke these access codes.

