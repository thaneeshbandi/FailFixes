import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🔥 React Error Caught:", error);
    console.error("📍 Error Info:", errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          fontFamily: 'Arial, sans-serif',
          background: '#ffebee',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <h1 style={{ color: '#d32f2f', marginBottom: '20px' }}>
            🚨 Something went wrong!
          </h1>
          <details style={{ 
            background: 'white', 
            padding: '20px', 
            borderRadius: '8px',
            textAlign: 'left',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Click to see error details
            </summary>
            <pre style={{ 
              marginTop: '10px', 
              color: '#d32f2f',
              fontSize: '14px',
              whiteSpace: 'pre-wrap'
            }}>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              fontSize: '16px',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
