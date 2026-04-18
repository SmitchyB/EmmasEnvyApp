// This file is used to handle the square card token modal for the frontend
import React, { useMemo } from 'react'; //Import the React and useMemo from react for the useMemo
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'; //Import the Modal, Pressable, StyleSheet, Text, and View from react-native for the modal, pressable, style sheet, text, and view
import { useSafeAreaInsets } from 'react-native-safe-area-context'; //Import the useSafeAreaInsets from react-native-safe-area-context for the safe area insets
import { WebView } from 'react-native-webview'; //Import the WebView from react-native-webview for the web view

// Type for the props
type Props = {
  visible: boolean; //If the visible is true, then the modal is visible
  applicationId: string; //The application id for the square card token modal
  locationId: string; //The location id for the square card token modal
  instanceKey: number; //The instance key for the square card token modal
  onClose: () => void; //The function to close the square card token modal
  onToken: (nonce: string) => void; //The function to token the square card nonce
  onError: (message: string) => void; //The function to error the square card token modal
};

// Function to build the square tokenize html
function buildSquareTokenizeHtml(applicationId: string, locationId: string, sandbox: boolean): string {
  //If the sandbox is true, then set the script src to the sandbox web square cdn, otherwise set the script src to the web square cdn
  const scriptSrc = sandbox
    ? 'https://sandbox.web.squarecdn.com/v1/square.js'
    : 'https://web.squarecdn.com/v1/square.js';
  const appJson = JSON.stringify(applicationId); //Set the app json to the application id
  const locJson = JSON.stringify(locationId); //Set the loc json to the location id
  //Return the html for the square tokenize modal
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system,BlinkMacSystemFont,sans-serif; margin: 0; padding: 16px; background: #fff; color: #111; }
    #card-container { min-height: 100px; margin-bottom: 16px; }
    #pay { width: 100%; padding: 16px; font-size: 16px; font-weight: 600; background: #c2185b; color: #fff; border: none; border-radius: 10px; }
    #pay:disabled { opacity: 0.5; }
    #msg { margin-top: 12px; font-size: 14px; color: #444; white-space: pre-wrap; }
  </style>
  <script src="${scriptSrc}"></script>
</head>
<body>
  <div id="card-container"></div>
  <button type="button" id="pay">Create card token</button>
  <div id="msg"></div>
  <script>
    (function () {
      var APP_ID = ${appJson};
      var LOC_ID = ${locJson};
      function post(kind, data) {
        var o = { kind: kind };
        for (var k in data) { if (Object.prototype.hasOwnProperty.call(data, k)) o[k] = data[k]; }
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(o));
          }
        } catch (e) {}
      }
      var msgEl = document.getElementById('msg');
      var payBtn = document.getElementById('pay');
      function setMsg(t) { msgEl.textContent = t || ''; }
      async function start() {
        try {
          if (!window.Square || !window.Square.payments) {
            setMsg('Square.js did not load. Check network and try again.');
            post('ERROR', { message: 'Square.js failed to load' });
            return;
          }
          var payments = window.Square.payments(APP_ID, LOC_ID);
          var card = await payments.card();
          await card.attach('#card-container');
          payBtn.onclick = async function () {
            payBtn.disabled = true;
            setMsg('Tokenizing…');
            try {
              var result = await card.tokenize();
              if (result.status === 'OK') {
                post('TOKEN', { token: result.token });
                setMsg('Token OK — returning to app…');
              } else {
                var errText = 'Tokenize failed';
                if (result.errors && result.errors.length) {
                  errText = result.errors.map(function (e) {
                    return e.detail || e.message || e.code || '';
                  }).filter(Boolean).join('; ') || errText;
                }
                post('ERROR', { message: errText });
                setMsg(errText);
                payBtn.disabled = false;
              }
            } catch (e) {
              var m = (e && e.message) ? e.message : String(e);
              post('ERROR', { message: m });
              setMsg(m);
              payBtn.disabled = false;
            }
          };
        } catch (e) {
          var m2 = (e && e.message) ? e.message : String(e);
          setMsg(m2);
          post('ERROR', { message: m2 });
        }
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
      } else {
        start();
      }
    })();
  </script>
</body>
</html>`;
}

// Function to render the square card token modal
export function SquareCardTokenModal({
  visible, //If the visible is true, then the modal is visible
  applicationId, //The application id for the square card token modal
  locationId, //The location id for the square card token modal
  instanceKey, //The instance key for the square card token modal
  onClose, //The function to close the square card token modal
  onToken, //The function to token the square card nonce
  onError, //The function to error the square card token modal
}: Props) {
  const insets = useSafeAreaInsets(); //Set the insets to the safe area insets
  const sandbox = useMemo(() => applicationId.startsWith('sandbox-'), [applicationId]); //If the application id starts with sandbox-, then set the sandbox to true, otherwise set the sandbox to false
  //Set the html to the html from the buildSquareTokenizeHtml
  const html = useMemo(
    () => buildSquareTokenizeHtml(applicationId, locationId, sandbox), //Build the square tokenize html
    [applicationId, locationId, sandbox] //Dependencies for the useMemo
  );

  const missing = !applicationId.trim() || !locationId.trim(); //If the application id or location id is not set, then set the missing to true, otherwise set the missing to false

  //Return the modal with the square card token modal
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Card entry (Square)</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeHit}>
            <Text style={styles.closeTxt}>Cancel</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>Use Square sandbox test cards. Each token is single-use.</Text>
        {missing ? (
          <Text style={styles.err}>
            Set EXPO_PUBLIC_SQUARE_APPLICATION_ID and EXPO_PUBLIC_SQUARE_LOCATION_ID in frontend/.env, then restart Expo.
          </Text>
        ) : (
          <WebView
            key={instanceKey}
            style={styles.web}
            source={{ html, baseUrl: 'https://localhost' }}
            onMessage={(ev) => {
              try {
                const data = JSON.parse(ev.nativeEvent.data) as { kind?: string; token?: string; message?: string };
                if (data.kind === 'TOKEN' && data.token) onToken(data.token);
                else if (data.kind === 'ERROR' && data.message) onError(data.message);
              } catch {
                /* ignore */
              }
            }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#1a1014' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  closeHit: { paddingVertical: 8 },
  closeTxt: { color: 'rgba(255,200,210,0.95)', fontSize: 16, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  err: { color: '#ffb4c0', paddingHorizontal: 16, fontSize: 14, lineHeight: 20 },
  web: { flex: 1, backgroundColor: '#fff' },
});
