$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Read-Xlsx($path,$out) {
  $z=[IO.Compression.ZipFile]::OpenRead($path)
  try {
    $shared=@(); $e=$z.GetEntry('xl/sharedStrings.xml')
    if($e){$r=[IO.StreamReader]::new($e.Open());try{[xml]$x=$r.ReadToEnd()}finally{$r.Dispose()};foreach($si in $x.SelectNodes("//*[local-name()='si']")){$shared+=(($si.SelectNodes(".//*[local-name()='t']")|ForEach-Object {$_.'#text'}) -join '')}}
    $e=@($z.Entries|Where-Object {$_.FullName -like 'xl/worksheets/*.xml'}|Select-Object -First 1);$r=[IO.StreamReader]::new($e.Open());try{[xml]$x=$r.ReadToEnd()}finally{$r.Dispose()}
    $rows=New-Object Collections.Generic.List[object]
    foreach($rn in $x.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")){
      $d=@{};$max=-1
      foreach($c in $rn.SelectNodes("./*[local-name()='c']")){$letters=([string]$c.r -replace '\d','');$col=0;foreach($ch in $letters.ToCharArray()){$col=$col*26+([int][char]$ch-64)};$col--;if($col -gt $max){$max=$col};$v=$c.SelectSingleNode("./*[local-name()='v']");$is=$c.SelectSingleNode("./*[local-name()='is']");$val='';if([string]$c.t -eq 's' -and $v){$val=[string]$shared[[int]$v.InnerText]}elseif([string]$c.t -eq 'inlineStr' -and $is){$val=(($is.SelectNodes(".//*[local-name()='t']")|ForEach-Object {$_.'#text'}) -join '')}elseif($v){$val=[string]$v.InnerText};$d[$col]=$val}
      $a=@();for($i=0;$i -le $max;$i++){if($d.ContainsKey($i)){$a+=,[string]$d[$i]}else{$a+=''}};[void]$rows.Add([object[]]$a)
    }
    @($rows)|ConvertTo-Json -Depth 10|Set-Content $out -Encoding UTF8;return @($rows)
  }finally{$z.Dispose()}
}
function Report($name,$rows){Write-Output "=== $name ===";Write-Output ('HEADER: '+($rows[0] -join ' | '));Write-Output ('TOTAL_ROWS: '+$rows.Count);Write-Output 'FIRST_15_DATA_ROWS:';for($i=1;$i -lt [Math]::Min(16,$rows.Count);$i++){Write-Output ($rows[$i] -join ' | ')};$h=$rows[0];$ix=@(0..($h.Count-1)|Where-Object {$h[$_] -match '(?i)(category|group)'});if(!$ix.Count){Write-Output 'CATEGORY_GROUP_COLUMNS: none detected'}else{foreach($j in $ix){Write-Output ('CATEGORY_GROUP_COLUMN: '+$h[$j]);$rows|Select-Object -Skip 1|ForEach-Object {[string]$_[$j]}|Group-Object|Sort-Object Name|ForEach-Object {Write-Output ('  {0} = {1}' -f $_.Name,$_.Count)}}}}
$b='C:\ADPORTS PROJECTS\NOATUM\Noatum Customer Portal\customer-platform\docs';$d=Read-Xlsx "$b\document_type_list.xlsx" 'C:\Users\jaison.joseph\AppData\Local\Temp\cw1-doc-types.json';$e=Read-Xlsx "$b\events_full_list.xlsx" 'C:\Users\jaison.joseph\AppData\Local\Temp\cw1-events.json';Report 'DOCUMENT TYPES' $d;Report 'EVENTS' $e
