# Benchmark: CPU and memory of a set of processes (regex on process name) for N seconds, sampled every S seconds.
# CPU % = share of the WHOLE machine (all logical cores), same as Task Manager's process CPU column summed.
param([string]$Match, [string]$Label, [int]$Seconds = 600, [int]$Step = 5, [string]$Out)
$cores = [Environment]::ProcessorCount
function Snap { Get-Process | Where-Object { $_.ProcessName -match $Match } }
$rows = @()
$prev = @{}; foreach ($p in Snap) { try { $prev[$p.Id] = $p.TotalProcessorTime.TotalSeconds } catch {} }
$t0 = Get-Date; $last = $t0
while (((Get-Date) - $t0).TotalSeconds -lt $Seconds) {
  Start-Sleep -Seconds $Step
  $now = Get-Date; $dt = ($now - $last).TotalSeconds; $last = $now
  $cpu = 0.0; $ws = 0; $priv = 0; $n = 0; $cur = @{}
  foreach ($p in Snap) {
    try {
      $c = $p.TotalProcessorTime.TotalSeconds; $cur[$p.Id] = $c
      if ($prev.ContainsKey($p.Id)) { $cpu += ($c - $prev[$p.Id]) }
      $ws += $p.WorkingSet64; $priv += $p.PrivateMemorySize64; $n++
    } catch {}
  }
  $prev = $cur
  $rows += [pscustomobject]@{ t = [int]($now - $t0).TotalSeconds; procs = $n; cpu_pct = [math]::Round(100 * $cpu / $dt / $cores, 2); ws_mb = [math]::Round($ws / 1MB); priv_mb = [math]::Round($priv / 1MB) }
}
$rows | Export-Csv -NoTypeInformation -Path $Out
$c = $rows.cpu_pct | Measure-Object -Average -Maximum
$w = $rows.ws_mb | Measure-Object -Average -Maximum
$v = $rows.priv_mb | Measure-Object -Average -Maximum
"{0}: samples {1}, procs {2}, CPU avg {3:N2}% max {4:N2}% (of {5} threads), RAM working set avg {6:N0} MB max {7:N0} MB, private avg {8:N0} MB" -f $Label, $rows.Count, ($rows | Select-Object -Last 1).procs, $c.Average, $c.Maximum, $cores, $w.Average, $w.Maximum, $v.Average
