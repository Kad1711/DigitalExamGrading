import React from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught UI error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/exams";
  };

  render() {
    if (this.state.hasError) {
      const isChunkLoadError =
        this.state.error?.name === "ChunkLoadError" ||
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Loading chunk");

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {isChunkLoadError
                  ? "Phiên bản ứng dụng đã được cập nhật"
                  : "Không thể hiển thị trang"}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                {isChunkLoadError
                  ? "Hệ thống vừa triển khai phiên bản mới. Vui lòng làm mới trang (hoặc nhấn Ctrl + F5) để tải giao diện mới nhất."
                  : "Đã xảy ra sự cố kỹ thuật trong quá trình hiển thị giao diện. Dữ liệu của bạn không bị ảnh hưởng."}
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
                  <span className="truncate max-w-[280px] font-mono text-rose-600">
                    {this.state.error.toString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  >
                    {this.state.showDetails ? (
                      <>
                        <span>Thu gọn</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>Chi tiết</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
                {this.state.showDetails && (
                  <pre className="text-[11px] font-mono text-slate-600 max-h-40 overflow-auto whitespace-pre-wrap bg-white p-2.5 rounded border border-slate-200">
                    {this.state.error.stack || "Không có stack trace."}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại trang</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold rounded-xl transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Về trang kỳ thi</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
