using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Metax.EnvironmentCheck
{
    // This is an environment check, not a gameplay or camera design decision.
    public sealed class SmokeController : MonoBehaviour
    {
        private bool smoke;
        private Vector3 start;

        private IEnumerator Start()
        {
            start = transform.position;
            smoke = Array.IndexOf(Environment.GetCommandLineArgs(), "-metaxSmoke") >= 0;
            Debug.Log("METAX_RUNTIME_STARTED");
            if (!smoke) yield break;
            yield return new WaitForSeconds(1f);
            bool moved = Vector3.Distance(start, transform.position) > 0.5f;
            Debug.Log(moved ? "METAX_RUNTIME_SMOKE_OK" : "METAX_RUNTIME_SMOKE_FAILED");
            string capture = Environment.GetEnvironmentVariable("METAX_SMOKE_SCREENSHOT");
            if (!string.IsNullOrEmpty(capture))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(capture));
                ScreenCapture.CaptureScreenshot(capture);
                yield return new WaitForSeconds(0.5f);
            }
            Application.Quit(moved ? 0 : 1);
        }

        private void Update()
        {
            Vector2 direction = Vector2.zero;
            var keyboard = Keyboard.current;
            if (keyboard != null)
            {
                direction.x = (keyboard.dKey.isPressed ? 1 : 0) - (keyboard.aKey.isPressed ? 1 : 0);
                direction.y = (keyboard.wKey.isPressed ? 1 : 0) - (keyboard.sKey.isPressed ? 1 : 0);
                if (keyboard.escapeKey.wasPressedThisFrame) Application.Quit();
            }
            if (smoke) direction = Vector2.right;
            transform.position += new Vector3(direction.x, 0, direction.y).normalized * (2f * Time.deltaTime);
        }

        private void OnGUI()
        {
            GUI.Box(new Rect(16, 16, 410, 80), "Metax — environment check");
            GUI.Label(new Rect(30, 45, 390, 40), "WASD: move the imported Blender object. Esc: quit.");
        }
    }
}
