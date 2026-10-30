# user-accounts Specification

## Purpose

End-user accounts on the public client: sign-up, sign-in, sign-out, and a persisted session, so favorites and cloud saves can belong to a person while guests keep full access to browse and play.

## Requirements

### Requirement: Sign-up
Visitors SHALL be able to create an account with email and password from the app, and be signed in immediately on success.

#### Scenario: New account
- **WHEN** a visitor submits a valid email and password on the sign-up form
- **THEN** the account is created, the visitor is signed in, and the header reflects the signed-in state

#### Scenario: Sign-up validation error
- **WHEN** the submitted credentials are rejected (for example the email is already in use)
- **THEN** the form shows the error and no session is created

### Requirement: Sign-in and sign-out
Users SHALL be able to sign in with email and password and sign out from the account menu, and the session SHALL persist across page reloads.

#### Scenario: Sign in
- **WHEN** a user signs in with valid credentials
- **THEN** user-only features (favorites, cloud saves) become available

#### Scenario: Sign out
- **WHEN** a signed-in user signs out
- **THEN** the session ends locally, user-only features hide, and browsing remains available

#### Scenario: Session survives reload
- **WHEN** a signed-in user reloads the page
- **THEN** they are still signed in without re-entering credentials

### Requirement: Invalid credentials are rejected
Sign-in with wrong credentials SHALL fail with a clear error and SHALL NOT establish a session.

#### Scenario: Wrong password
- **WHEN** a user signs in with a wrong password
- **THEN** an invalid-credentials message is shown and no session exists

### Requirement: Guest access unchanged
All browse, details, and play functionality SHALL remain available without an account; user-only features SHALL present a sign-in prompt instead of failing.

#### Scenario: Guest plays
- **WHEN** a visitor without an account opens a game and plays
- **THEN** the game plays normally with local (non-synced) saves

#### Scenario: Guest triggers a user-only feature
- **WHEN** a guest activates a user-only feature such as favoriting
- **THEN** they are prompted to sign in rather than seeing an error

### Requirement: User session isolated from admin session
The end-user session SHALL be stored separately from the admin superuser session; signing in or out of one SHALL NOT affect the other.

#### Scenario: Both sessions active
- **WHEN** a superuser is signed in on the admin client and a user signs in on the public client in the same browser
- **THEN** both sessions remain valid and independent
