param(
    [ValidateSet('Doctor', 'Open', 'Code', 'Blender', 'Export', 'Scene', 'Build', 'Run')]
    [string]$Action = 'Doctor'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$project = Join-Path $repo 'unity\Metaxu'
$editor = 'C:\Dev\Tools\Unity\6000.3.23f1\Editor\Unity.exe'
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$artifact = Join-Path $repo 'artifacts'
New-Item -ItemType Directory -Force -Path $artifact | Out-Null
function Require-File([string]$path) {
    if (!(Test-Path -LiteralPath $path)) { throw "Not installed: $path" }
}
switch ($Action) {
    'Doctor' {
        git --version
        git lfs version
        unity --version
        dotnet --list-sdks
        [pscustomobject]@{ UnityEditor = (Test-Path $editor); Blender = (Test-Path $blender); Project = $project }
        unity auth status
        unity license status
    }
    'Open' { Require-File $editor; unity open $project }
    'Code' { code (Join-Path $repo 'Metax.code-workspace') }
    'Blender' {
        Require-File $blender
        Start-Process $blender -ArgumentList @('--python', ('"' + (Join-Path $PSScriptRoot 'blender\start_mcp.py') + '"')) -WindowStyle Hidden
    }
    'Export' {
        Require-File $blender
        & $blender --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'blender\create_smoke_asset.py')
        if ($LASTEXITCODE -ne 0) { throw "Blender export failed: $LASTEXITCODE" }
    }
    { $_ -in 'Scene', 'Build' } {
        Require-File $editor
        if (Test-Path (Join-Path $project 'Temp\UnityLockfile')) { throw 'Close this Unity project before a batch operation.' }
        $method = if ($Action -eq 'Scene') {'CreateScene'} else {'BuildWindows'}
        & $editor -batchmode -quit -projectPath $project -executeMethod "Metax.EnvironmentCheck.EnvironmentSetup.$method" -logFile (Join-Path $artifact "$Action.log")
        if ($LASTEXITCODE -ne 0) { throw "Unity $Action failed: $LASTEXITCODE. Read artifacts/$Action.log" }
    }
    'Run' {
        $exe = Join-Path $artifact 'Windows\MetaxSmoke.exe'
        Require-File $exe
        Start-Process $exe -WindowStyle Hidden
    }
}
