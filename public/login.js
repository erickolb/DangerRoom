export async function signIn() {
  if (window.DangerRoomAndroid) return;
  const health = await fetch('/api/health').then(r => r.json());
  if (!health.authentication_required) return;
  const addLogout = () => { const button=document.createElement('button');button.className='quiet';button.textContent='Sign out';button.onclick=async()=>{await fetch('/api/session',{method:'DELETE'});location.reload();};document.querySelector('footer').prepend(button); };
  if ((await fetch('/api/device')).status !== 401) { addLogout(); return; }
  const panel = document.querySelector('#app');
  panel.innerHTML = '<h2>Open your DangerRoom</h2><p>Enter the browser access key configured by your administrator.</p><form id="sign-in"><label>Browser access key<input name="token" type="password" autocomplete="current-password" required></label><button>Sign in</button><p role="alert"></p></form>';
  await new Promise(resolve => {
    panel.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const button = event.target.querySelector('button'); button.disabled = true;
      try {
        const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: new FormData(event.target).get('token') }) });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        resolve();
      } catch (error) { event.target.querySelector('[role=alert]').textContent = error.message; }
      finally { button.disabled = false; }
    };
  });
  addLogout();
}
