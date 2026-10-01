param([Parameter(Mandatory = $true)][string]$RuntimeDirectory)

$ErrorActionPreference = 'Stop'
# Somente leitura: não libera arquivos, não importa certificados e não altera políticas.
$runtimePath = (Resolve-Path -LiteralPath $RuntimeDirectory).ProviderPath
if (-not (Test-Path -LiteralPath $runtimePath -PathType Container)) { throw 'Pasta de runtime inválida.' }
$binaryFiles = @(Get-ChildItem -LiteralPath $runtimePath -File | Where-Object { $_.Extension -in '.exe', '.dll' })
if ($binaryFiles.Count -eq 0) { throw 'Runtime sem executáveis ou bibliotecas.' }
$signatures = @($binaryFiles | ForEach-Object {
    $signature = Get-AuthenticodeSignature -LiteralPath $_.FullName
    [pscustomobject]@{ file = $_.Name; status = [string]$signature.Status }
})

$smartAppControl = 'unknown'
try {
    $policy = Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' -Name VerifiedAndReputablePolicyState
    $smartAppControl = switch ($policy.VerifiedAndReputablePolicyState) { 0 { 'off' } 1 { 'on' } 2 { 'evaluation' } default { 'unknown' } }
} catch { <# Sem acesso não significa que a proteção esteja desligada. #> }

$eventsReadable = $false
$blocks = @()
try {
    # A consulta por ID não executa o runtime nem abre uma nova janela de erro.
    # O resultado contém só o nome do binário, nunca mensagens completas do Windows.
    $events = @(Get-WinEvent -FilterHashtable @{
        LogName = 'Microsoft-Windows-CodeIntegrity/Operational'
        StartTime = (Get-Date).AddDays(-1)
        Id = 3077
    } -MaxEvents 200 -ErrorAction Stop)
    $eventsReadable = $true
    $blocks = @($events | ForEach-Object {
        $event = $_
        foreach ($binary in $binaryFiles) {
            # O Windows usa \Device\HarddiskVolume em vez da letra da unidade no evento.
            $suffix = $binary.FullName.Substring([IO.Path]::GetPathRoot($binary.FullName).Length - 1)
            if ($event.Message.IndexOf($suffix, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                [pscustomobject]@{ file = $binary.Name; eventId = 3077; at = $event.TimeCreated.ToUniversalTime().ToString('o') }
            }
        }
    } | Select-Object -First 10)
} catch {
    if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { $eventsReadable = $true }
}

[pscustomobject]@{
    smartAppControl = $smartAppControl
    signatures = $signatures
    eventsReadable = $eventsReadable
    recentBlocks = $blocks
} | ConvertTo-Json -Depth 5 -Compress
