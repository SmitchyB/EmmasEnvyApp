export type SignupDraft = {
  email?: string;
  phone?: string;
  password: string;
  identifierType: 'email' | 'phone';
};

let draft: SignupDraft | null = null;

export function setSignupDraft(data: SignupDraft): void {
  draft = data;
}

export function getSignupDraft(): SignupDraft | null {
  return draft;
}

export function clearSignupDraft(): void {
  draft = null;
}
