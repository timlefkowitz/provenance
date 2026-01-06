export default function TestPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>✅ Test Page Works!</h1>
      <p>If you can see this, the deployment is working.</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  );
}

