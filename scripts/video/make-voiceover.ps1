# Renders each voiceover line to its own WAV using the Windows speech engine.
# Separate files let the build place each line at an exact timecode instead of
# relying on however long a single continuous read happens to take.

param(
  [string]$OutDir = "video/audio",
  [string]$Voice  = "Microsoft Zira Desktop",
  [int]$Rate      = 0
)

Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$lines = @(
  @{ name = "vo1"; text = "Padlock. A password manager that cannot read your passwords." }
  @{ name = "vo2"; text = "Your logins appear right where you need them, matched to the site you are on." }
  @{ name = "vo3"; text = "Generate strong passwords on the spot, with live strength feedback." }
  @{ name = "vo4"; text = "Your master password never leaves your device." }
  @{ name = "vo5"; text = "Padlock. Free. No ads, no tracking." }
)

foreach ($line in $lines) {
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try { $synth.SelectVoice($Voice) } catch { Write-Output "voice '$Voice' unavailable, using default" }
  $synth.Rate = $Rate
  $path = Join-Path (Resolve-Path $OutDir) ($line.name + ".wav")
  $synth.SetOutputToWaveFile($path)
  $synth.Speak($line.text)
  $synth.Dispose()
  $len = (Get-Item $path).Length
  Write-Output ("{0,-5} {1,8} bytes  {2}" -f $line.name, $len, $line.text)
}
