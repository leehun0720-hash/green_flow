import React from "react";

// 화면 하나가 예상치 못한 오류로 죽어도 앱 전체가 하얗게 멈추지 않도록 막는 안전망.
// App.jsx에서 탭 콘텐츠를 이걸로 감싸고 tab을 key로 넘겨서, 다른 메뉴로 이동하면
// 에러 상태가 자동으로 초기화되게 한다.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ borderColor: "var(--red)" }}>
          <h3 style={{ color: "var(--red)", marginTop: 0 }}>이 화면을 표시하는 중 오류가 발생했습니다</h3>
          <p className="hint">{this.state.error.message || "알 수 없는 오류"}</p>
          <p className="hint">
            왼쪽 메뉴에서 다른 화면으로 이동하면 정상적으로 계속 쓸 수 있습니다. 같은 오류가 반복되면
            화면 이름과 이 메시지를 개발 담당자에게 전달해주세요.
          </p>
          <button className="ghost" onClick={() => this.setState({ error: null })}>
            이 화면 다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
