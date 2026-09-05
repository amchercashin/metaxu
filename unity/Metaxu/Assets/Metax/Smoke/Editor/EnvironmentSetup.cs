using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Metax.EnvironmentCheck
{
    public static class EnvironmentSetup
    {
        private const string Folder = "Assets/Metax/Smoke";
        public const string ScenePath = Folder + "/EnvironmentCheck.unity";

        [MenuItem("Metax/Environment/Create smoke scene")]
        public static void CreateScene()
        {
            Directory.CreateDirectory(Folder);
            AssetDatabase.Refresh();
            var imported = AssetDatabase.LoadAssetAtPath<GameObject>(Folder + "/Models/SmokeMarker.fbx");
            if (!imported) throw new InvalidOperationException("Export SmokeMarker.fbx from Blender first.");
            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/Settings/PC_RPAsset.asset");
            GraphicsSettings.defaultRenderPipeline = pipeline;
            QualitySettings.renderPipeline = pipeline;
            if (!pipeline)
                throw new InvalidOperationException("The project must have an active URP asset.");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camera = new GameObject("Camera").AddComponent<Camera>();
            camera.tag = "MainCamera";
            camera.transform.position = new Vector3(7, 7, -9);
            camera.transform.LookAt(new Vector3(0, 0.5f, 0));
            camera.GetUniversalAdditionalCameraData().renderPostProcessing = false;
            camera.gameObject.AddComponent<AudioListener>();
            camera.backgroundColor = new Color(0.17f, 0.23f, 0.29f);
            camera.clearFlags = CameraClearFlags.SolidColor;
            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 2;
            sun.shadows = LightShadows.Soft;
            sun.transform.rotation = Quaternion.Euler(45, -30, 0);
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.5f, 0.55f, 0.6f);
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.name = "Ground";
            floor.GetComponent<Renderer>().sharedMaterial = Material("Ground", new Color(0.34f, 0.40f, 0.30f));
            var marker = (GameObject)PrefabUtility.InstantiatePrefab(imported);
            marker.name = "Blender import — WASD";
            if (marker.GetComponentsInChildren<MeshFilter>().Length == 0)
                throw new InvalidOperationException("FBX imported without a mesh.");
            foreach (var renderer in marker.GetComponentsInChildren<Renderer>())
                renderer.sharedMaterial = Material("Terracotta", new Color(0.65f, 0.25f, 0.10f));
            marker.AddComponent<SmokeController>();
            EditorSettings.serializationMode = SerializationMode.ForceText;
            VersionControlSettings.mode = "Visible Meta Files";
            EditorPrefs.SetString("kScriptsDefaultApp", Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs/Microsoft VS Code/Code.exe"));
            PlayerSettings.companyName = "Metax";
            PlayerSettings.productName = "Metax Environment Check";
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.runInBackground = true;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("METAX_UNITY_SCENE_OK");
        }

        [MenuItem("Metax/Environment/Build Windows smoke check")]
        public static void BuildWindows()
        {
            if (!File.Exists(ScenePath)) CreateScene();
            string output = Path.GetFullPath("../../artifacts/Windows/MetaxSmoke.exe");
            Directory.CreateDirectory(Path.GetDirectoryName(output));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { ScenePath }, locationPathName = output,
                target = BuildTarget.StandaloneWindows64, options = BuildOptions.Development
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException("Windows build failed: " + report.summary.result);
            Debug.Log("METAX_WINDOWS_BUILD_OK " + output);
        }

        private static Material Material(string name, Color color)
        {
            string path = Folder + "/" + name + ".mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (!material)
            {
                material = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                AssetDatabase.CreateAsset(material, path);
            }
            material.color = color;
            return material;
        }

    }
}
