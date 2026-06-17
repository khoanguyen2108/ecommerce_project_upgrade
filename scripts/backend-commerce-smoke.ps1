$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Fail {
  param([Parameter(Mandatory = $true)][string]$Message)
  throw [System.Exception]::new($Message)
}

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$DefaultValue = $null
  )

  $value = [Environment]::GetEnvironmentVariable($Name)

  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  return $value
}

function Get-EnvBool {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [bool]$DefaultValue = $false
  )

  $value = [Environment]::GetEnvironmentVariable($Name)

  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  switch -Regex ($value.Trim().ToLowerInvariant()) {
    '^(1|true|yes|y|on)$' { return $true }
    '^(0|false|no|n|off)$' { return $false }
    default { Fail "$Name must be a boolean value: true/false, 1/0, yes/no, or on/off." }
  }
}

function Assert-RequiredEnv {
  param([Parameter(Mandatory = $true)][string[]]$Names)

  $missing = @()

  foreach ($name in $Names) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
      $missing += $name
    }
  }

  if ($missing.Count -gt 0) {
    Fail ("Missing required env vars: {0}" -f ($missing -join ', '))
  }
}

function Assert-Equals {
  param(
    [object]$Actual,
    [object]$Expected,
    [Parameter(Mandatory = $true)][string]$Message
  )

  if ($Actual -ne $Expected) {
    Fail ("{0} Expected '{1}', got '{2}'." -f $Message, $Expected, $Actual)
  }
}

function Assert-True {
  param(
    [bool]$Condition,
    [Parameter(Mandatory = $true)][string]$Message
  )

  if (-not $Condition) {
    Fail $Message
  }
}

function Assert-NotBlank {
  param(
    [object]$Value,
    [Parameter(Mandatory = $true)][string]$Message
  )

  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
    Fail $Message
  }
}

function Has-Property {
  param(
    [object]$Object,
    [Parameter(Mandatory = $true)][string]$Name
  )

  return $null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name
}

function As-Array {
  param([object]$Value)

  if ($null -eq $Value) {
    return @()
  }

  if ($Value -is [System.Array]) {
    return $Value
  }

  return @($Value)
}

function Join-ApiUrl {
  param([Parameter(Mandatory = $true)][string]$Path)

  if ($Path.StartsWith('http://') -or $Path.StartsWith('https://')) {
    return $Path
  }

  if (-not $Path.StartsWith('/')) {
    $Path = "/$Path"
  }

  return "$script:ApiBaseUrl$Path"
}

function Read-ErrorResponseContent {
  param([object]$Response)

  if ($null -eq $Response) {
    return ''
  }

  if ($Response -is [System.Net.Http.HttpResponseMessage]) {
    return $Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  }

  if ($Response.PSObject.Methods.Name -contains 'GetResponseStream') {
    $stream = $Response.GetResponseStream()

    if ($null -eq $stream) {
      return ''
    }

    $reader = [System.IO.StreamReader]::new($stream)

    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  }

  if (Has-Property -Object $Response -Name 'Content') {
    return [string]$Response.Content
  }

  return ''
}

function Invoke-SmokeRequest {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST', 'PATCH', 'DELETE')][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body = $null,
    [hashtable]$Headers = @{},
    [int[]]$ExpectedStatus = @(200)
  )

  $url = Join-ApiUrl -Path $Path
  $displayPath = $Path
  Write-Host ("--> {0} {1}" -f $Method, $displayPath)

  $requestParams = @{
    Method = $Method
    Uri = $url
    TimeoutSec = 30
    UseBasicParsing = $true
  }

  if ($null -ne $Headers -and $Headers.Count -gt 0) {
    $requestParams.Headers = $Headers
  }

  if ($null -ne $Body) {
    $requestParams.Body = ($Body | ConvertTo-Json -Depth 20)
    $requestParams.ContentType = 'application/json'
  }

  $statusCode = 0
  $content = ''

  try {
    $response = Invoke-WebRequest @requestParams
    $statusCode = [int]$response.StatusCode
    $content = [string]$response.Content
  } catch {
    $errorResponse = $_.Exception.Response

    if ($null -eq $errorResponse) {
      Fail ("Request failed before receiving an HTTP response for {0} {1}: {2}" -f $Method, $displayPath, $_.Exception.Message)
    }

    $statusCode = [int]$errorResponse.StatusCode
    $content = Read-ErrorResponseContent -Response $errorResponse
  }

  $parsed = $null

  if (-not [string]::IsNullOrWhiteSpace($content)) {
    try {
      $parsed = $content | ConvertFrom-Json
    } catch {
      Fail ("Response from {0} {1} was not valid JSON." -f $Method, $displayPath)
    }
  }

  Write-Host ("<-- {0}" -f $statusCode)

  if ($ExpectedStatus -notcontains $statusCode) {
    $code = Get-EnvelopeErrorCode -ResponseBody $parsed

    if ($code) {
      Fail ("Expected HTTP {0} for {1} {2}, got {3} ({4})." -f ($ExpectedStatus -join '/'), $Method, $displayPath, $statusCode, $code)
    }

    Fail ("Expected HTTP {0} for {1} {2}, got {3}." -f ($ExpectedStatus -join '/'), $Method, $displayPath, $statusCode)
  }

  return [pscustomobject]@{
    StatusCode = $statusCode
    Body = $parsed
  }
}

function Get-EnvelopeErrorCode {
  param([object]$ResponseBody)

  if ($null -ne $ResponseBody -and (Has-Property -Object $ResponseBody -Name 'error') -and $null -ne $ResponseBody.error) {
    return $ResponseBody.error.code
  }

  return $null
}

function Get-EnvelopeData {
  param(
    [Parameter(Mandatory = $true)][object]$Response,
    [Parameter(Mandatory = $true)][string]$Context
  )

  if ($null -eq $Response.Body) {
    Fail "$Context returned an empty response body."
  }

  $errorCode = Get-EnvelopeErrorCode -ResponseBody $Response.Body

  if ($errorCode) {
    Fail "$Context returned API error $errorCode."
  }

  if (-not (Has-Property -Object $Response.Body -Name 'data')) {
    Fail "$Context did not return the standard API envelope."
  }

  return $Response.Body.data
}

function Get-AuthHeaders {
  param([Parameter(Mandatory = $true)][string]$AccessToken)

  return @{
    Authorization = "Bearer $AccessToken"
  }
}

function Login-SmokeUser {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][string]$Password
  )

  $response = Invoke-SmokeRequest `
    -Method 'POST' `
    -Path '/auth/login' `
    -Body @{ email = $Email; password = $Password } `
    -ExpectedStatus @(200)
  $data = Get-EnvelopeData -Response $response -Context "$Label login"

  Assert-NotBlank -Value $data.accessToken -Message "$Label login did not return an access token."
  Assert-NotBlank -Value $data.user.role -Message "$Label login did not return a user role."

  Write-Host ("OK {0} login accepted with role {1}." -f $Label, $data.user.role)

  return [pscustomobject]@{
    AccessToken = [string]$data.accessToken
    Role = [string]$data.user.role
    UserId = [string]$data.user.id
  }
}

function Find-CartItemByVariant {
  param(
    [Parameter(Mandatory = $true)][object]$Cart,
    [Parameter(Mandatory = $true)][string]$VariantId
  )

  foreach ($item in @(As-Array -Value $Cart.items)) {
    if ($item.variantId -eq $VariantId) {
      return $item
    }
  }

  return $null
}

function Add-TestItemToCart {
  param([Parameter(Mandatory = $true)][hashtable]$Headers)

  $response = Invoke-SmokeRequest `
    -Method 'POST' `
    -Path '/cart/items' `
    -Headers $Headers `
    -Body @{ variantId = $script:TestVariantId; quantity = 1 } `
    -ExpectedStatus @(201)
  $data = Get-EnvelopeData -Response $response -Context 'POST /cart/items'
  $item = Find-CartItemByVariant -Cart $data.cart -VariantId $script:TestVariantId

  if ($null -eq $item) {
    Fail 'Cart add response did not include the requested test variant.'
  }

  return [pscustomobject]@{
    Cart = $data.cart
    Item = $item
  }
}

function Assert-CartEmpty {
  param(
    [Parameter(Mandatory = $true)][object]$Cart,
    [Parameter(Mandatory = $true)][string]$Context
  )

  $items = @(As-Array -Value $Cart.items)
  Assert-Equals -Actual $items.Count -Expected 0 -Message "$Context cart should be empty."
}

function Assert-NoPaidState {
  param(
    [Parameter(Mandatory = $true)][object]$Order,
    [Parameter(Mandatory = $true)][string]$Context
  )

  if ((Has-Property -Object $Order -Name 'status') -and $Order.status -eq 'PAID') {
    Fail "$Context order was unexpectedly marked PAID."
  }

  if ((Has-Property -Object $Order -Name 'paidAt') -and $null -ne $Order.paidAt) {
    Fail "$Context order has paidAt set unexpectedly."
  }

  if (Has-Property -Object $Order -Name 'payments') {
    foreach ($payment in @(As-Array -Value $Order.payments)) {
      if ($payment.status -eq 'PAID' -or $null -ne $payment.paidAt) {
        Fail "$Context contains an unexpectedly paid payment."
      }
    }
  }
}

function Assert-NoConfiguredSecretsInResponse {
  param(
    [Parameter(Mandatory = $true)][object]$ResponseBody,
    [Parameter(Mandatory = $true)][string[]]$EnvNames
  )

  $json = $ResponseBody | ConvertTo-Json -Depth 50 -Compress

  foreach ($name in $EnvNames) {
    $value = [Environment]::GetEnvironmentVariable($name)

    if ([string]::IsNullOrWhiteSpace($value) -or $value.Length -lt 6) {
      continue
    }

    if ($json.Contains($value)) {
      Fail "$name value appeared in an API response."
    }
  }
}

function Invoke-DisplayOnlyStatusSmoke {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('return', 'cancel')][string]$Source,
    [Parameter(Mandatory = $true)][string]$OrderId,
    [Parameter(Mandatory = $true)][hashtable]$Headers
  )

  $encodedOrderId = [uri]::EscapeDataString($OrderId)
  $path = "/payments/payos/$Source/status?orderId=$encodedOrderId"
  $response = Invoke-SmokeRequest `
    -Method 'GET' `
    -Path $path `
    -Headers $Headers `
    -ExpectedStatus @(200, 404)

  if ($response.StatusCode -eq 404) {
    $code = Get-EnvelopeErrorCode -ResponseBody $response.Body
    Assert-Equals -Actual $code -Expected 'PAYMENT_NOT_FOUND' -Message "Display-only $Source status without a payOS payment row should return PAYMENT_NOT_FOUND."
    Write-Host ("OK payOS {0} status returned PAYMENT_NOT_FOUND without creating payment state." -f $Source)
    return
  }

  $data = Get-EnvelopeData -Response $response -Context "GET /payments/payos/$Source/status"
  Assert-True -Condition ($data.displayOnly -eq $true) -Message "payOS $Source status did not declare displayOnly=true."

  if ($null -ne $data.order) {
    Assert-NoPaidState -Order $data.order -Context "payOS $Source status order"
  }

  if ($null -ne $data.payment -and ($data.payment.status -eq 'PAID' -or $null -ne $data.payment.paidAt)) {
    Fail "payOS $Source status returned an unexpectedly paid payment."
  }

  Write-Host ("OK payOS {0} status is display-only." -f $Source)
}

try {
  $script:ApiBaseUrl = (Get-EnvValue -Name 'API_BASE_URL' -DefaultValue 'http://localhost:3001').Trim().TrimEnd('/')

  Assert-RequiredEnv -Names @(
    'CUSTOMER_EMAIL',
    'CUSTOMER_PASSWORD',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'TEST_VARIANT_ID'
  )

  $script:TestVariantId = (Get-EnvValue -Name 'TEST_VARIANT_ID').Trim()
  $customerEmail = (Get-EnvValue -Name 'CUSTOMER_EMAIL').Trim()
  $customerPassword = Get-EnvValue -Name 'CUSTOMER_PASSWORD'
  $adminEmail = (Get-EnvValue -Name 'ADMIN_EMAIL').Trim()
  $adminPassword = Get-EnvValue -Name 'ADMIN_PASSWORD'
  $staffEmail = Get-EnvValue -Name 'OPTIONAL_STAFF_EMAIL'
  $staffPassword = Get-EnvValue -Name 'OPTIONAL_STAFF_PASSWORD'
  $allowMutatingAdminActions = Get-EnvBool -Name 'ALLOW_MUTATING_ADMIN_ACTIONS' -DefaultValue $false
  $allowPayosProviderCalls = Get-EnvBool -Name 'ALLOW_PAYOS_PROVIDER_CALLS' -DefaultValue $false
  $allowPayosWebhookFixture = Get-EnvBool -Name 'ALLOW_PAYOS_WEBHOOK_FIXTURE' -DefaultValue $false
  $adminOrderMutation = (Get-EnvValue -Name 'ADMIN_ORDER_MUTATION' -DefaultValue 'cancel').Trim().ToLowerInvariant()

  if (($null -eq $staffEmail) -xor ($null -eq $staffPassword)) {
    Fail 'Set both OPTIONAL_STAFF_EMAIL and OPTIONAL_STAFF_PASSWORD, or leave both blank.'
  }

  if ($null -ne $staffEmail) {
    $staffEmail = $staffEmail.Trim()
  }

  if ($allowPayosProviderCalls) {
    Fail 'ALLOW_PAYOS_PROVIDER_CALLS=true is not supported by this smoke script. It intentionally never calls the payOS provider.'
  }

  if ($allowPayosWebhookFixture) {
    Fail 'ALLOW_PAYOS_WEBHOOK_FIXTURE=true is not supported by this smoke script. It intentionally never calls the payOS webhook route.'
  }

  if ($adminOrderMutation -notin @('cancel', 'expire')) {
    Fail 'ADMIN_ORDER_MUTATION must be cancel or expire.'
  }

  Write-Host ''
  Write-Host 'Belikeme backend commerce smoke'
  Write-Host ("API_BASE_URL: {0}" -f $script:ApiBaseUrl)
  Write-Host 'This script will check health, login customer/admin users, mutate the customer test cart, and create a real PENDING_PAYMENT order from checkout.'
  Write-Host 'It will not print passwords, bearer tokens, cookies, or raw provider secrets.'
  Write-Host 'It will not call payOS create, payOS provider APIs, or the payOS webhook route.'
  Write-Host 'It assumes migrations are already applied. Safe local/dev command: cd backend && npx prisma migrate deploy'

  if ($allowMutatingAdminActions) {
    Write-Host ("Admin cancel/expire smoke is enabled and will create a separate order for {0}." -f $adminOrderMutation)
  } else {
    Write-Host 'Admin cancel/expire smoke is disabled. Set ALLOW_MUTATING_ADMIN_ACTIONS=true to enable it.'
  }

  Write-Host ''

  $health = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/health' -ExpectedStatus @(200)) `
    -Context 'GET /health'
  Assert-Equals -Actual $health.status -Expected 'ok' -Message 'GET /health status mismatch.'

  $dbHealth = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/health/db' -ExpectedStatus @(200)) `
    -Context 'GET /health/db'
  Assert-Equals -Actual $dbHealth.status -Expected 'ok' -Message 'GET /health/db status mismatch.'

  $redisHealth = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/health/redis' -ExpectedStatus @(200)) `
    -Context 'GET /health/redis'
  Assert-Equals -Actual $redisHealth.status -Expected 'ok' -Message 'GET /health/redis status mismatch.'
  Write-Host 'OK health checks passed.'

  $customerSession = Login-SmokeUser -Label 'customer' -Email $customerEmail -Password $customerPassword
  $adminSession = Login-SmokeUser -Label 'admin' -Email $adminEmail -Password $adminPassword
  Assert-Equals -Actual $adminSession.Role -Expected 'ADMIN' -Message 'ADMIN_EMAIL credentials must belong to an ADMIN user.'

  $customerHeaders = Get-AuthHeaders -AccessToken $customerSession.AccessToken
  $adminHeaders = Get-AuthHeaders -AccessToken $adminSession.AccessToken

  $initialCartData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/cart' -Headers $customerHeaders -ExpectedStatus @(200)) `
    -Context 'GET /cart'
  $initialItems = @(As-Array -Value $initialCartData.cart.items)

  if ($initialItems.Count -ne 0) {
    Fail ("Customer cart is not empty ({0} item(s)). Use a dedicated test customer or clear the cart manually; no cart mutations were attempted after this check." -f $initialItems.Count)
  }

  Write-Host 'OK initial customer cart is empty.'

  $cartAdd = Add-TestItemToCart -Headers $customerHeaders
  Assert-Equals -Actual $cartAdd.Item.quantity -Expected 1 -Message 'Added cart item quantity mismatch.'
  Write-Host 'OK cart item added.'

  $patchPath = "/cart/items/$($cartAdd.Item.id)"
  $patchedCartData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'PATCH' -Path $patchPath -Headers $customerHeaders -Body @{ quantity = 1 } -ExpectedStatus @(200)) `
    -Context 'PATCH /cart/items/:id'
  $patchedItem = Find-CartItemByVariant -Cart $patchedCartData.cart -VariantId $script:TestVariantId
  Assert-Equals -Actual $patchedItem.quantity -Expected 1 -Message 'Patched cart item quantity mismatch.'
  Write-Host 'OK cart item patched.'

  $deletedCartData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'DELETE' -Path $patchPath -Headers $customerHeaders -ExpectedStatus @(200)) `
    -Context 'DELETE /cart/items/:id'
  $deletedItem = Find-CartItemByVariant -Cart $deletedCartData.cart -VariantId $script:TestVariantId
  Assert-True -Condition ($null -eq $deletedItem) -Message 'Deleted cart item still appears in cart.'
  Write-Host 'OK cart item deleted.'

  $checkoutCartAdd = Add-TestItemToCart -Headers $customerHeaders
  Assert-Equals -Actual $checkoutCartAdd.Item.quantity -Expected 1 -Message 'Checkout cart item quantity mismatch.'
  Write-Host 'OK cart item added again for checkout.'

  $summaryData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/checkout/summary' -Headers $customerHeaders -ExpectedStatus @(200)) `
    -Context 'GET /checkout/summary'
  $summaryItems = @(As-Array -Value $summaryData.summary.items)
  Assert-True -Condition ($summaryItems.Count -gt 0) -Message 'Checkout summary did not include items.'
  Assert-True -Condition ($summaryData.summary.totalAmount -gt 0) -Message 'Checkout summary total must be positive.'
  Write-Host 'OK checkout summary returned recalculated totals.'

  $orderData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'POST' -Path '/checkout/orders' -Headers $customerHeaders -ExpectedStatus @(201)) `
    -Context 'POST /checkout/orders'
  $createdOrder = $orderData.order
  Assert-NotBlank -Value $createdOrder.id -Message 'Checkout order response did not include an order id.'
  Assert-Equals -Actual $createdOrder.status -Expected 'PENDING_PAYMENT' -Message 'Checkout order status mismatch.'

  if (Has-Property -Object $createdOrder -Name 'expiresAt') {
    Assert-NotBlank -Value $createdOrder.expiresAt -Message 'Checkout order response included expiresAt but it was blank.'
  }

  Assert-NoPaidState -Order $createdOrder -Context 'Created checkout order'
  Write-Host ("OK checkout created PENDING_PAYMENT order {0}." -f $createdOrder.id)

  $postCheckoutCartData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/cart' -Headers $customerHeaders -ExpectedStatus @(200)) `
    -Context 'GET /cart after checkout'
  Assert-CartEmpty -Cart $postCheckoutCartData.cart -Context 'Post-checkout'
  Write-Host 'OK cart is empty after checkout.'

  $customerOrdersData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/orders' -Headers $customerHeaders -ExpectedStatus @(200)) `
    -Context 'GET /orders'
  $customerOrders = @(As-Array -Value $customerOrdersData.orders)
  Assert-True -Condition (@($customerOrders | Where-Object { $_.id -eq $createdOrder.id }).Count -gt 0) -Message 'Customer order list did not include the checkout order.'

  $customerOrderDetailData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path "/orders/$($createdOrder.id)" -Headers $customerHeaders -ExpectedStatus @(200)) `
    -Context 'GET /orders/:id'
  Assert-Equals -Actual $customerOrderDetailData.order.id -Expected $createdOrder.id -Message 'Customer order detail id mismatch.'
  Assert-NoPaidState -Order $customerOrderDetailData.order -Context 'Customer order detail'
  Write-Host 'OK customer order list/detail passed.'

  $adminOrdersData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/admin/orders' -Headers $adminHeaders -ExpectedStatus @(200)) `
    -Context 'GET /admin/orders'
  $adminOrders = @(As-Array -Value $adminOrdersData.orders)
  Assert-True -Condition (@($adminOrders | Where-Object { $_.id -eq $createdOrder.id }).Count -gt 0) -Message 'Admin order list did not include the checkout order.'

  $adminOrderDetailData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path "/admin/orders/$($createdOrder.id)" -Headers $adminHeaders -ExpectedStatus @(200)) `
    -Context 'GET /admin/orders/:id'
  Assert-Equals -Actual $adminOrderDetailData.order.id -Expected $createdOrder.id -Message 'Admin order detail id mismatch.'
  Assert-NoPaidState -Order $adminOrderDetailData.order -Context 'Admin order detail'
  Write-Host 'OK admin order list/detail passed.'

  $readinessResponse = Invoke-SmokeRequest `
    -Method 'GET' `
    -Path '/admin/payments/payos/readiness' `
    -Headers $adminHeaders `
    -ExpectedStatus @(200)
  $readinessData = Get-EnvelopeData -Response $readinessResponse -Context 'GET /admin/payments/payos/readiness'
  Assert-True -Condition ($null -ne $readinessData.readiness) -Message 'payOS readiness response did not include readiness data.'
  Assert-NoConfiguredSecretsInResponse -ResponseBody $readinessResponse.Body -EnvNames @(
    'PAYOS_CLIENT_ID',
    'PAYOS_API_KEY',
    'PAYOS_CHECKSUM_KEY'
  )
  $warningCount = @(As-Array -Value $readinessData.readiness.warnings).Count
  Write-Host ("OK payOS readiness returned safe diagnostics (environmentReady={0}, warnings={1})." -f $readinessData.readiness.environmentReady, $warningCount)

  $adminPaymentsData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path '/admin/payments' -Headers $adminHeaders -ExpectedStatus @(200)) `
    -Context 'GET /admin/payments'
  $adminPayments = @(As-Array -Value $adminPaymentsData.payments)
  Write-Host ("OK admin payments list returned {0} payment row(s) on this page." -f $adminPayments.Count)

  Invoke-DisplayOnlyStatusSmoke -Source 'return' -OrderId $createdOrder.id -Headers $customerHeaders
  Invoke-DisplayOnlyStatusSmoke -Source 'cancel' -OrderId $createdOrder.id -Headers $customerHeaders

  $afterDisplayOrderData = Get-EnvelopeData `
    -Response (Invoke-SmokeRequest -Method 'GET' -Path "/orders/$($createdOrder.id)" -Headers $customerHeaders -ExpectedStatus @(200)) `
    -Context 'GET /orders/:id after display status'
  Assert-NoPaidState -Order $afterDisplayOrderData.order -Context 'Order after display-only payment status calls'
  Write-Host 'OK display-only payment status calls did not mark the order/payment paid.'

  $unauthCartResponse = Invoke-SmokeRequest -Method 'GET' -Path '/cart' -ExpectedStatus @(401)
  Assert-Equals -Actual (Get-EnvelopeErrorCode -ResponseBody $unauthCartResponse.Body) -Expected 'AUTH_REQUIRED' -Message 'Unauthenticated cart request error code mismatch.'

  $customerAdminResponse = Invoke-SmokeRequest -Method 'GET' -Path '/admin/orders' -Headers $customerHeaders -ExpectedStatus @(403)
  Assert-Equals -Actual (Get-EnvelopeErrorCode -ResponseBody $customerAdminResponse.Body) -Expected 'FORBIDDEN' -Message 'Customer admin-order request error code mismatch.'

  if ($null -ne $staffEmail) {
    $staffSession = Login-SmokeUser -Label 'staff' -Email $staffEmail -Password $staffPassword
    Assert-Equals -Actual $staffSession.Role -Expected 'STAFF' -Message 'OPTIONAL_STAFF credentials must belong to a STAFF user.'
    $staffHeaders = Get-AuthHeaders -AccessToken $staffSession.AccessToken
    $staffAdminResponse = Invoke-SmokeRequest -Method 'GET' -Path '/admin/orders' -Headers $staffHeaders -ExpectedStatus @(403)
    Assert-Equals -Actual (Get-EnvelopeErrorCode -ResponseBody $staffAdminResponse.Body) -Expected 'FORBIDDEN' -Message 'Staff admin-order request error code mismatch.'
    Write-Host 'OK staff admin-order negative auth passed.'
  } else {
    Write-Host 'Skipping staff negative auth; OPTIONAL_STAFF_EMAIL/PASSWORD were not provided.'
  }

  Write-Host 'OK negative auth checks passed.'

  if ($allowMutatingAdminActions) {
    $mutationCartAdd = Add-TestItemToCart -Headers $customerHeaders
    Assert-Equals -Actual $mutationCartAdd.Item.quantity -Expected 1 -Message 'Admin mutation setup cart item quantity mismatch.'

    $mutationOrderData = Get-EnvelopeData `
      -Response (Invoke-SmokeRequest -Method 'POST' -Path '/checkout/orders' -Headers $customerHeaders -ExpectedStatus @(201)) `
      -Context 'POST /checkout/orders for admin mutation smoke'
    $mutationOrder = $mutationOrderData.order
    Assert-Equals -Actual $mutationOrder.status -Expected 'PENDING_PAYMENT' -Message 'Admin mutation setup order status mismatch.'
    Assert-NoPaidState -Order $mutationOrder -Context 'Admin mutation setup order'

    $mutationResponseData = Get-EnvelopeData `
      -Response (Invoke-SmokeRequest -Method 'PATCH' -Path "/admin/orders/$($mutationOrder.id)/$adminOrderMutation" -Headers $adminHeaders -ExpectedStatus @(200)) `
      -Context "PATCH /admin/orders/:id/$adminOrderMutation"
    $expectedMutationStatus = if ($adminOrderMutation -eq 'cancel') { 'CANCELLED' } else { 'EXPIRED' }
    Assert-Equals -Actual $mutationResponseData.order.status -Expected $expectedMutationStatus -Message 'Admin mutation order status mismatch.'
    Assert-NoPaidState -Order $mutationResponseData.order -Context 'Admin mutation response order'

    $mutationVerifyData = Get-EnvelopeData `
      -Response (Invoke-SmokeRequest -Method 'GET' -Path "/admin/orders/$($mutationOrder.id)" -Headers $adminHeaders -ExpectedStatus @(200)) `
      -Context 'GET /admin/orders/:id after admin mutation'
    Assert-Equals -Actual $mutationVerifyData.order.status -Expected $expectedMutationStatus -Message 'Admin mutation verify status mismatch.'
    Assert-NoPaidState -Order $mutationVerifyData.order -Context 'Admin mutation verified order'
    Write-Host ("OK optional admin {0} smoke transitioned a separate order without paid state." -f $adminOrderMutation)
  }

  Write-Host ''
  Write-Host 'Smoke completed successfully.'
  exit 0
} catch {
  [Console]::Error.WriteLine(("ERROR: {0}" -f $_.Exception.Message))
  exit 1
}
