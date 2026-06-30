// Config
export { initSharedConfig, getConfig, apiUrl, uploadsUrl } from './config';
export type { SharedConfig } from './config';

// Constants
export { STATUS_CANCELED, DEFAULT_DAY_START, DEFAULT_DAY_END, SLOT_STEP_MINUTES } from './constants/booking';
export { AUTH_TOKEN_KEY, DEVICE_ID_KEY, GUEST_TICKET_KEY } from './constants/storage-keys';

// Types
export type { User, AuthSession, Requires2FAResponse, AuthSessionItem } from './types/auth';
export type {
  Appointment,
  AppointmentStatus,
  ServiceType,
  CreateAppointmentBody,
} from './types/booking';
export type {
  SupportHandlerTeam,
  SupportTicketStatus,
  IssueTypeOption,
  SupportTicket,
  SupportMessage,
  GuestInvoiceOption,
} from './types/tickets';
export type { Portfolio, PortfolioPhoto } from './types/portfolio';
export type { RewardTypeApi, RewardOfferingDto, MeRewardsResponse } from './types/rewards';
export type { DiscountTypeApi, PromoCodeDto, NewsletterDto } from './types/newsletters';
export type { SiteSettings } from './types/site-settings';
export type { DataExportPayload } from './types/data-privacy';

// Utils
export { isStaffRole } from './utils/roles';
export {
  durationToMinutes,
  minutesToDurationString,
  timeToMinutes,
  minutesToTime,
} from './utils/booking-duration';
export { computeAvailableSlots, isSlotStillAvailable } from './utils/appointment-availability';
export { serviceLabel } from './utils/labels';

// Signup draft
export type { SignupDraft } from './signup-draft';
export { setSignupDraft, getSignupDraft, clearSignupDraft } from './signup-draft';

// API client
export { fetchWithAuth } from './api/client';
export { getSiteSettings } from './api/site-settings';

// Auth API
export {
  login,
  register,
  verify2FA,
  update2FA,
  completeProfile,
  uploadProfilePhoto,
  updateProfile,
  updateAccount,
  getSessions,
  revokeSession,
  requestPasswordReset,
  verifyForgotCode,
  completeForgotPassword,
  untrustSession,
} from './api/auth';
export type { CompleteProfilePayload, CompleteProfileResult } from './api/auth';

// Booking API
export {
  fetchAppointmentAvailability,
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointmentApi,
  uploadAppointmentFinishedPhoto,
  fetchPublicServiceTypes,
  listMyServiceTypes,
  createServiceTypeApi,
  updateServiceTypeApi,
  deleteServiceTypeApi,
} from './api/booking';

// Tickets API
export {
  fetchIssueTypes,
  listMyTickets,
  listStaffTickets,
  getTicket,
  createTicket,
  closeTicketAsCustomer,
  patchTicketStaff,
  postTicketMessage,
  guestCreateTicket,
  guestClaimTicket,
  guestGetThread,
  guestPostMessage,
  guestCloseTicket,
  guestFindRecords,
  guestVerifyAppointment,
} from './api/tickets';

// Portfolio API
export {
  getPrimaryPortfolio,
  getMyPortfolio,
  saveMyPortfolio,
  uploadPortfolioPhoto,
  updatePortfolioPhoto,
  deletePortfolioPhoto,
} from './api/portfolio';

// Rewards API
export {
  listRewardOfferingsAdmin,
  createRewardOfferingApi,
  patchRewardOfferingApi,
  deleteRewardOfferingApi,
  listAvailableRewardOfferings,
  getMeRewards,
} from './api/rewards';

// Newsletters / promos API
export {
  listPromoCodes,
  createPromoCodeApi,
  patchPromoCodeApi,
  deletePromoCodeApi,
  listNewslettersApi,
  createNewsletterApi,
  patchNewsletterApi,
  deleteNewsletterApi,
  sendNewsletterApi,
} from './api/newsletters';

// Data privacy API
export { requestDataExport, deleteAccountApi } from './api/data-privacy';
