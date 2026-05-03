$ErrorActionPreference = "Continue"
$pass = 0; $fail = 0; $bugs = @()

function T($name, $method, $url, $body, $hdrs, $expect) {
    try {
        $p = @{ Uri=$url; Method=$method; UseBasicParsing=$true; TimeoutSec=15 }
        if ($hdrs) { $p.Headers=$hdrs }
        if ($body) { $p.Body=$body; $p.ContentType="application/json" }
        $r = Invoke-WebRequest @p
        $s = $r.StatusCode; $c = $r.Content
    } catch {
        $s = 0
        if ($_.Exception.Response) {
            $s = [int]$_.Exception.Response.StatusCode
            $sr = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($sr)
            $c = $reader.ReadToEnd()
        } else { $c = $_.Exception.Message }
    }
    $ok = ($expect -eq $s)
    if ($ok) { $script:pass++; Write-Host "[PASS] $name => $s" }
    else { $script:fail++; $script:bugs += "$name (got $s, expected $expect)"; Write-Host "[FAIL] $name => $s (expected $expect) | $($c.Substring(0,[Math]::Min(120,$c.Length)))" }
    return $c
}

Write-Host "============================================"
Write-Host " BACKEND API TESTS"
Write-Host "============================================"

# --- Health ---
T "T-B01 Health" "GET" "http://localhost:3001/health" $null $null 200

# --- Auth login ---
$c = T "T-B02.1 Login admin" "POST" "http://localhost:3001/api/auth/login" '{"email":"admin@salon-beaute.fr","password":"admin12345"}' $null 200
$adminToken = ($c | ConvertFrom-Json).data.token
$ah = @{Authorization="Bearer $adminToken"}

$c = T "T-B02.2 Login coiffeuse" "POST" "http://localhost:3001/api/auth/login" '{"email":"fatima@salon-beaute.fr","password":"coiffeuse123"}' $null 200
$coiffToken = ($c | ConvertFrom-Json).data.token
$ch = @{Authorization="Bearer $coiffToken"}

$c = T "T-B02.3 Login cliente" "POST" "http://localhost:3001/api/auth/login" '{"email":"test@cliente.fr","password":"cliente123"}' $null 200
$clienteToken = ($c | ConvertFrom-Json).data.token
$clh = @{Authorization="Bearer $clienteToken"}

T "T-B02.4 Login wrong pw" "POST" "http://localhost:3001/api/auth/login" '{"email":"admin@salon-beaute.fr","password":"wrong"}' $null 401
T "T-B02.5 Login no user" "POST" "http://localhost:3001/api/auth/login" '{"email":"noone@x.fr","password":"test1234"}' $null 401
T "T-B02.6 Login no pw" "POST" "http://localhost:3001/api/auth/login" '{"email":"admin@salon-beaute.fr"}' $null 422
T "T-B02.7 Login bad email" "POST" "http://localhost:3001/api/auth/login" '{"email":"notemail","password":"x"}' $null 422

# --- Auth me ---
T "T-B02.11 Me with token" "GET" "http://localhost:3001/api/auth/me" $null $ah 200
T "T-B02.12 Me no token" "GET" "http://localhost:3001/api/auth/me" $null $null 401
T "T-B02.13 Me bad token" "GET" "http://localhost:3001/api/auth/me" $null @{Authorization="Bearer invalidtoken"} 401

# --- Services (public) ---
$c = T "T-B03.1 Services list" "GET" "http://localhost:3001/api/services" $null $null 200
$svc = ($c | ConvertFrom-Json).data
if ($svc.Count -lt 1) { Write-Host "[FAIL] No services returned"; $script:fail++; $script:bugs += "No services" } else { Write-Host "  => $($svc.Count) services" }
$svcId = $svc[0].id

T "T-B03.2 Services by cat" "GET" "http://localhost:3001/api/services?categorie=COUPE" $null $null 200
T "T-B03.4 Service by id" "GET" "http://localhost:3001/api/services/$svcId" $null $null 200
T "T-B03.5 Service 404" "GET" "http://localhost:3001/api/services/nonexistent-id" $null $null 404
T "T-B03.6 Create svc no auth" "POST" "http://localhost:3001/api/services" '{"nom":"X","categorie":"COUPE","prixBase":10,"dureeMinutes":15}' $null 401
T "T-B03.7 Create svc CLIENTE" "POST" "http://localhost:3001/api/services" '{"nom":"X","categorie":"COUPE","prixBase":10,"dureeMinutes":15}' $clh 403

# --- Coiffeuses (public) ---
$c = T "T-B04.1 Coiffeuses list" "GET" "http://localhost:3001/api/coiffeuses" $null $null 200
$coifs = ($c | ConvertFrom-Json).data
$coifId = $coifs[0].id
Write-Host "  => $($coifs.Count) coiffeuses, first id: $coifId"

T "T-B04.2 Coiffeuse by id" "GET" "http://localhost:3001/api/coiffeuses/$coifId" $null $null 200
T "T-B04.3 Dispo lundi" "GET" "http://localhost:3001/api/coiffeuses/$coifId/disponibilites?date=2026-04-13" $null $null 200
T "T-B04.4 Dispo dimanche" "GET" "http://localhost:3001/api/coiffeuses/$coifId/disponibilites?date=2026-04-12" $null $null 200
T "T-B04.5 Dispo no date" "GET" "http://localhost:3001/api/coiffeuses/$coifId/disponibilites" $null $null 400
T "T-B04.6 Coiffeuse me" "GET" "http://localhost:3001/api/coiffeuses/me" $null $ch 200

# --- Admin Dashboard ---
T "T-B06.1 Dashboard no auth" "GET" "http://localhost:3001/api/admin/dashboard" $null $null 401
T "T-B06.2 Dashboard CLIENTE" "GET" "http://localhost:3001/api/admin/dashboard" $null $clh 403
$c = T "T-B06.3 Dashboard ADMIN" "GET" "http://localhost:3001/api/admin/dashboard" $null $ah 200
$dash = ($c | ConvertFrom-Json).data
Write-Host "  => RDV aujourd'hui: $($dash.rdvAujourdhui), Clientes: $($dash.totalClientes), CA mois: $($dash.caMois)"

T "T-B06.4 Stats" "GET" "http://localhost:3001/api/admin/stats" $null $ah 200
T "T-B06.5 Stats graphique" "GET" "http://localhost:3001/api/admin/stats/graphique" $null $ah 200
T "T-B06.6 Clients" "GET" "http://localhost:3001/api/admin/clients" $null $ah 200
T "T-B06.7 Coiffeuses admin" "GET" "http://localhost:3001/api/admin/coiffeuses" $null $ah 200

# --- Admin Stock ---
$c = T "T-B08.1 Produits" "GET" "http://localhost:3001/api/admin/produits" $null $ah 200
$prods = ($c | ConvertFrom-Json).data
if ($prods.produits) { Write-Host "  => $($prods.produits.Count) produits" }
T "T-B08.6 Mouvements" "GET" "http://localhost:3001/api/admin/stock/mouvements" $null $ah 200

# --- Admin Parametres ---
T "T-B10.1 Get params" "GET" "http://localhost:3001/api/admin/parametres" $null $ah 200
T "T-B10.3 Params CLIENTE" "PUT" "http://localhost:3001/api/admin/parametres" '{"nomSalon":"Test"}' $clh 403

# --- Clientes ---
T "T-B09.1 Profil cliente" "GET" "http://localhost:3001/api/clientes/profil" $null $clh 200
T "T-B09.3 Historique" "GET" "http://localhost:3001/api/clientes/historique" $null $clh 200
T "T-B09.1b Profil no auth" "GET" "http://localhost:3001/api/clientes/profil" $null $null 401
T "T-B09.1c Profil ADMIN" "GET" "http://localhost:3001/api/clientes/profil" $null $ah 403

# --- RDV ---
T "T-B05.2 RDV no auth" "POST" "http://localhost:3001/api/rendez-vous" '{"coiffeuseId":"x","dateHeure":"2026-04-14T10:00:00","serviceIds":["x"]}' $null 401
T "T-B05.6 RDV list cliente" "GET" "http://localhost:3001/api/rendez-vous" $null $clh 200
T "T-B05.7 RDV list admin" "GET" "http://localhost:3001/api/rendez-vous" $null $ah 200

# --- RDV creation test (unique date based on epoch seconds to guarantee no conflicts) ---
$epoch = [int][double]::Parse((Get-Date -UFormat %s))
$daysAhead = 100 + ($epoch % 200)
$futureDate = (Get-Date).AddDays($daysAhead)
while ($futureDate.DayOfWeek -ne 'Monday') { $futureDate = $futureDate.AddDays(1) }
$rdvDate = $futureDate.ToString("yyyy-MM-dd") + "T09:00:00.000Z"
Write-Host "  => RDV test date: $rdvDate"
$rdvBody = '{"coiffeuseId":"' + $coifId + '","dateHeure":"' + $rdvDate + '","serviceIds":["' + $svcId + '"]}'
$c = T "T-B05.1 Create RDV" "POST" "http://localhost:3001/api/rendez-vous" $rdvBody $clh 201
if ($c) {
    $rdvData = ($c | ConvertFrom-Json).data
    if ($rdvData.id) {
        $rdvId = $rdvData.id
        Write-Host "  => RDV created: $rdvId"
        T "T-B05.9 Confirm RDV" "PATCH" "http://localhost:3001/api/rendez-vous/$rdvId/statut" '{"statut":"CONFIRME"}' $ch 200
        T "T-B05.10 Terminate RDV" "PATCH" "http://localhost:3001/api/rendez-vous/$rdvId/statut" '{"statut":"TERMINE"}' $ch 200
    }
}

# --- Walk-in (same Monday + afternoon slot) ---
$walkDate = $futureDate.ToString("yyyy-MM-dd") + "T15:00:00.000Z"
$walkBody = '{"walkInNom":"Client Test","dateHeure":"' + $walkDate + '","serviceIds":["' + $svcId + '"]}'
T "T-B05.12 Walk-in" "POST" "http://localhost:3001/api/rendez-vous/presentiel" $walkBody $ch 201

# --- 404 route ---
T "T-B12.1 Route 404" "GET" "http://localhost:3001/api/nonexistent" $null $null 404

# --- Register test ---
$regBody = '{"email":"newtest' + (Get-Random) + '@test.fr","password":"password123","nom":"TestN","prenom":"TestP","telephone":"0612345678"}'
T "T-B02.8 Register" "POST" "http://localhost:3001/api/auth/register" $regBody $null 201
T "T-B02.9 Register dup" "POST" "http://localhost:3001/api/auth/register" '{"email":"admin@salon-beaute.fr","password":"password123","nom":"T","prenom":"T","telephone":"06"}' $null 422

Write-Host "`n============================================"
Write-Host " RESULTATS: $pass PASS / $fail FAIL"
Write-Host "============================================"
if ($bugs.Count -gt 0) {
    Write-Host "`nBUGS TROUVES:"
    $bugs | ForEach-Object { Write-Host "  - $_" }
}
