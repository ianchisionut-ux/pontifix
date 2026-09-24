$ErrorActionPreference = 'Stop'
$fixturesJson = & node scripts/test-tax-tools.cjs --xml-fixtures
if ($LASTEXITCODE -ne 0) { throw 'Fixture tests failed.' }
$fixtures = $fixturesJson | ConvertFrom-Json
$schemaPath = Join-Path $PSScriptRoot '../assets/anaf/d394_20250917.xsd'
foreach ($fixture in $fixtures) {
  $settings = New-Object System.Xml.XmlReaderSettings
  $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
  $settings.XmlResolver = $null
  $settings.ValidationType = [System.Xml.ValidationType]::Schema
  [void]$settings.Schemas.Add('mfp:anaf:dgti:d394:declaratie:v5', $schemaPath)
  $settings.add_ValidationEventHandler({ param($sender, $eventArgs) throw $eventArgs.Message })
  $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($fixture), $settings)
  try { while ($reader.Read()) {} } finally { $reader.Dispose() }
}
Write-Output "D394 fixtures validated against the official ANAF XSD. This does not replace Soft J validation."
