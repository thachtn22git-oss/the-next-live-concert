import { Component } from 'react';
export function ErrorFallback() {
  return <main id="main-content" className="site-container section-space min-h-[60vh]" tabIndex={-1}>
    <p className="eyebrow">The Next Live Concert</p><h1 className="page-title">Đã xảy ra lỗi.</h1>
    <p className="body-copy mt-6" role="alert">Vui lòng tải lại trang hoặc quay về trang chủ.</p>
    <div className="mt-8 flex flex-wrap gap-4"><button className="button button-pink" onClick={() => window.location.reload()}>TẢI LẠI</button><a className="text-link" href="/">VỀ TRANG CHỦ</a></div>
  </main>;
}
export default class ErrorBoundary extends Component {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  render() { return this.state.failed ? <ErrorFallback /> : this.props.children; }
}
