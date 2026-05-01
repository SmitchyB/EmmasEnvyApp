//Support ticket issue types and handler_team mapping.

//HANDLER_BY_ISSUE is a object that maps the issue type to the handler team
const HANDLER_BY_ISSUE = {
  app_crash_or_freeze: 'it',
  login_2fa_password: 'it',
  account_recovery_lost_email_or_phone: 'it',
  payment_checkout_error: 'it',
  booking_app_bug: 'it',
  photo_upload_display: 'it',
  app_slow_or_error_message: 'it',
  appointment_change_policy: 'admin',
  service_pricing_menu: 'admin',
  rewards_promo_newsletter: 'admin',
  invoice_receipt_billing: 'admin',
  account_profile_non_login: 'admin',
  privacy_data_request: 'admin',
  general_other: 'admin',
};

//ISSUE_TYPE_LABELS is a object that maps the issue type to the issue type label
const ISSUE_TYPE_LABELS = {
  app_crash_or_freeze: 'App crashes, freezes, or won’t open',
  login_2fa_password: 'Can’t sign in, 2FA, or password reset',
  account_recovery_lost_email_or_phone: 'Lost access to email or phone — account recovery',
  payment_checkout_error: 'Payment or checkout error (card / Square)',
  booking_app_bug: 'Booking or calendar issue in the app',
  photo_upload_display: 'Photo won’t upload or display',
  app_slow_or_error_message: 'Slow loading, blank screen, or error message',
  appointment_change_policy: 'Reschedule, cancel, or appointment policy',
  service_pricing_menu: 'Services, pricing, or packages',
  rewards_promo_newsletter: 'Rewards, promos, or newsletter',
  invoice_receipt_billing: 'Receipt, invoice, or billing question',
  account_profile_non_login: 'Update name, phone, or email on file',
  privacy_data_request: 'Privacy or data request',
  general_other: 'Something else',
};

//function to get the handler team for an issue type
function getHandlerTeamForIssue(issueType) {
  return HANDLER_BY_ISSUE[issueType] || null;
}

//function to check if an issue type is valid
function isValidIssueType(issueType) {
  return Boolean(issueType && HANDLER_BY_ISSUE[issueType]);
}

//function to list the issue types for the api
function listIssueTypesForApi() {
  return Object.keys(HANDLER_BY_ISSUE).map((id) => ({
    id,
    label: ISSUE_TYPE_LABELS[id] || id,
    handler_team: HANDLER_BY_ISSUE[id],
  }));
}

//export the functions
module.exports = {
  HANDLER_BY_ISSUE,
  ISSUE_TYPE_LABELS,
  getHandlerTeamForIssue,
  isValidIssueType,
  listIssueTypesForApi,
};
