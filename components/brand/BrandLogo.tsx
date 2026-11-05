/** Full official lockup. Keep environment names outside the supplied artwork. */
export function BrandLogo({ environment }: { environment?: string }) {
  return <span className="brand-lockup">
    <img className="brand-logo" src="/images/brand/bi-society-logo.png" alt="BI.Society" width={4000} height={4000} />
    {environment && <span className="brand-environment">{environment}</span>}
  </span>;
}
