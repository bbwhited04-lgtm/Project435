param(
  [Parameter(Mandatory=$true)]
  [string]$Path
)

if (-not (Test-Path $Path)) {
  throw "Installer not found: $Path"
}

$sig = Get-AuthenticodeSignature -FilePath $Path

[pscustomobject]@{
  Path   = $Path
  Status = $sig.Status.ToString()
  Signer = $sig.SignerCertificate.Subject
  Issuer = $sig.SignerCertificate.Issuer
} | Format-List

if ($sig.Status -ne 'Valid') {
  throw "Signature is not valid: $($sig.Status)"
}
