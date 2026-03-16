
 //In-memory store for sign-up form data when navigating to the 2FA choice screen.
 //Never persisted; cleared after use so password is not stored.
export type SignupDraft = {
  email?: string; // Email of the user
  phone?: string; // Phone of the user
  password: string; // Password of the user
  identifierType: 'email' | 'phone'; // Identifier type of the user
};

let draft: SignupDraft | null = null; // Draft of the signup

export function setSignupDraft(data: SignupDraft): void {
  draft = data; // Set the draft to the data
}

export function getSignupDraft(): SignupDraft | null {
  return draft; // Return the draft
}

export function clearSignupDraft(): void {
  draft = null; // Set the draft to null
}
