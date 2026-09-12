import { NavLink } from "react-router-dom";

export function PolicyBar() {
  return (
    <nav className="policy-bar" aria-label="Legal and policies">
      <div className="policy-bar-inner">
        <span className="policy-bar-label">Policies:</span>
        <NavLink to="/privacy" className={({ isActive }) => isActive ? "policy-link active" : "policy-link"}>Privacy Policy</NavLink>
        <NavLink to="/terms" className={({ isActive }) => isActive ? "policy-link active" : "policy-link"}>Terms</NavLink>
        <NavLink to="/cookies" className={({ isActive }) => isActive ? "policy-link active" : "policy-link"}>Cookies</NavLink>
        <NavLink to="/refund" className={({ isActive }) => isActive ? "policy-link active" : "policy-link"}>Refund</NavLink>
        <span className="policy-bar-hint" aria-hidden="true">— updated 12 Sep 2026</span>
      </div>
    </nav>
  );
}
