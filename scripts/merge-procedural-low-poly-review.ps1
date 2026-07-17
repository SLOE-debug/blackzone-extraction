param(
  [string]$OutputPath = 'docs/procedural-low-poly-architecture-review.md'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = (Resolve-Path (Join-Path $scriptDirectory '..')).Path
$docsRoot = Join-Path $repositoryRoot 'docs'
$overviewPath = Join-Path $docsRoot 'procedural-low-poly-call-trees.md'
$vanguardPath = Join-Path $docsRoot 'call-trees/vanguard.md'
$lobbyWallsPath = Join-Path $docsRoot 'call-trees/lobby-walls.md'
$curveCrawlerPath = Join-Path $docsRoot 'call-trees/curve-crawler.md'
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)

<# 读取 UTF-8 Markdown，并统一换行符供后续标题转换。 #>
function Read-Markdown([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "合并源文档不存在：$Path"
  }
  return [System.IO.File]::ReadAllText($Path, $utf8WithoutBom).Replace("`r`n", "`n")
}

<# 将独立调用树文档降一级，并把内部章节编号改成合并文档编号。 #>
function Convert-DetailSection(
  [string]$Content,
  [int]$SectionNumber,
  [string]$Title
) {
  $result = [System.Collections.Generic.List[string]]::new()
  $result.Add("## $SectionNumber. $Title")
  $result.Add('')

  $firstHeadingSkipped = $false
  foreach ($line in $Content.Trim().Split("`n")) {
    if (-not $firstHeadingSkipped -and $line -match '^# ') {
      $firstHeadingSkipped = $true
      continue
    }
    if ($line -match '^## ([0-9]+)\. (.+)$') {
      $result.Add("### $SectionNumber.$($Matches[1]) $($Matches[2])")
      continue
    }
    if ($line -match '^### (.+)$') {
      $result.Add("#### $($Matches[1])")
      continue
    }
    $result.Add($line)
  }

  return ($result -join "`n").TrimEnd()
}

<# 把总览文档最后的约束章节从原编号 7 调整到合并版编号 9。 #>
function Convert-TailNumbering([string]$Content) {
  $result = [System.Collections.Generic.List[string]]::new()
  foreach ($line in $Content.Trim().Split("`n")) {
    if ($line -match '^## 7\. (.+)$') {
      $result.Add("## 9. $($Matches[1])")
      continue
    }
    if ($line -match '^### 7\.([0-9]+) (.+)$') {
      $result.Add("### 9.$($Matches[1]) $($Matches[2])")
      continue
    }
    $result.Add($line)
  }
  return ($result -join "`n").TrimEnd()
}

$overview = Read-Markdown $overviewPath
$detailMarker = '## 6. 调用树入口'
$tailMarker = '## 7. 当前约束'
$detailIndex = $overview.IndexOf($detailMarker, [System.StringComparison]::Ordinal)
$tailIndex = $overview.IndexOf($tailMarker, [System.StringComparison]::Ordinal)
if ($detailIndex -lt 0 -or $tailIndex -le $detailIndex) {
  throw '总览文档缺少预期的调用树入口或当前约束章节标记。'
}

$introduction = $overview.Substring(0, $detailIndex).TrimEnd()
$introduction = [regex]::Replace(
  $introduction,
  '^# .+$',
  '# 程序化 Low Poly 架构评审材料（合并版）',
  [System.Text.RegularExpressions.RegexOptions]::Multiline
)
$tail = Convert-TailNumbering $overview.Substring($tailIndex)

$sections = @(
  $introduction,
  (Convert-DetailSection (Read-Markdown $vanguardPath) 6 '玩家 Vanguard 调用树'),
  (Convert-DetailSection (Read-Markdown $lobbyWallsPath) 7 '大厅墙壁调用树'),
  (Convert-DetailSection (Read-Markdown $curveCrawlerPath) 8 '蜘蛛 Curve Crawler 调用树'),
  $tail
)
$combined = (($sections | ForEach-Object { $_.Trim() }) -join "`n`n---`n`n") + "`n"

$firstLevelHeadingCount = [regex]::Matches($combined, '(?m)^# ').Count
if ($firstLevelHeadingCount -ne 1) {
  throw "合并文档必须只有一个一级标题，实际为 $firstLevelHeadingCount 个。"
}

$absoluteOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  [System.IO.Path]::GetFullPath($OutputPath)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputPath))
}
$outputDirectory = Split-Path -Parent $absoluteOutputPath
if (-not (Test-Path -LiteralPath $outputDirectory -PathType Container)) {
  [void](New-Item -ItemType Directory -Path $outputDirectory -Force)
}
[System.IO.File]::WriteAllText($absoluteOutputPath, $combined, $utf8WithoutBom)
Write-Output $absoluteOutputPath
