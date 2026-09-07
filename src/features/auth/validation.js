export function normalizeEmail(value = '') {
  return value.trim().toLowerCase();
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)) && value.trim().length <= 254
    ? '' : 'Vui lòng nhập địa chỉ email hợp lệ.';
}

export function validatePassword(password = '', confirmation) {
  if (password.length < 8) return 'Mật khẩu cần có ít nhất 8 ký tự.';
  if (password.length > 128) return 'Mật khẩu không được vượt quá 128 ký tự.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Mật khẩu cần có cả chữ và số.';
  if (confirmation !== undefined && password !== confirmation) return 'Mật khẩu xác nhận chưa khớp.';
  return '';
}

export function validateRegistration(values) {
  const errors = {};
  if (values.fullName.trim().length < 2 || values.fullName.trim().length > 120) errors.fullName = 'Họ và tên cần từ 2 đến 120 ký tự.';
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!/^\+?[0-9]{9,15}$/.test(values.phone.replace(/[\s().-]/g, ''))) errors.phone = 'Vui lòng nhập số điện thoại hợp lệ (9 đến 15 chữ số).';
  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;
  if (values.password !== values.confirmPassword) errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
  return errors;
}

export function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/profile';
  if (/^\/(login|register|forgot-password|reset-password)([/?#]|$)/.test(value)) return '/profile';
  return value;
}
