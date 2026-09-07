const messages = {
  invalid_credentials: 'Email hoặc mật khẩu chưa đúng.',
  email_not_confirmed: 'Bạn cần xác nhận email trước khi đăng nhập. Vui lòng kiểm tra hộp thư.',
  user_already_exists: 'Không thể đăng ký với email này. Hãy đăng nhập hoặc đặt lại mật khẩu.',
  email_exists: 'Không thể đăng ký với email này. Hãy đăng nhập hoặc đặt lại mật khẩu.',
  weak_password: 'Mật khẩu chưa đủ mạnh. Hãy dùng mật khẩu dài hơn, có chữ và số.',
  same_password: 'Mật khẩu mới cần khác mật khẩu hiện tại.',
  over_email_send_rate_limit: 'Bạn đã yêu cầu gửi email quá nhiều lần. Vui lòng đợi một lát rồi thử lại.',
  over_request_rate_limit: 'Bạn thao tác quá nhanh. Vui lòng đợi một lát rồi thử lại.',
  signup_disabled: 'Đăng ký tài khoản hiện chưa được mở. Vui lòng quay lại sau.',
  otp_expired: 'Liên kết đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.',
  session_not_found: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  refresh_token_not_found: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
};

export function authErrorMessage(error) {
  if (error?.code === 'not_configured') return 'Tài khoản hiện chưa khả dụng. Vui lòng thử lại sau.';
  return messages[error?.code] || 'Chưa thể hoàn tất yêu cầu. Vui lòng kiểm tra kết nối và thử lại.';
}
