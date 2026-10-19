/* Site settings — edit these, no build step needed. */
window.WH_CONFIG = {
  // Where quote + contact submissions are POSTed as JSON (Formspree, Web3Forms,
  // a Make/Zapier webhook, or your CRM). Leave empty and the site falls back to
  // opening the visitor's email app with the enquiry pre-filled, so no lead is lost.
  formEndpoint: "",

  leadEmail: "inquiries@watthausstrategy.co.nz",
  phone: "+64 21 090 58051",
  phoneHref: "tel:+642109058051",

  // Assumptions behind the savings estimates (shown as "indicative" on the site).
  pricePerKwh: 0.33,   // NZ$ average retail import price
  exportRate: 0.12,    // NZ$ per kWh exported to the grid
  dailyCharge: 2.0,    // NZ$ fixed daily line charge, excluded from usage
  yieldPerKwp: 1360,   // kWh per kWp per year — from the Auckland Residence case study
  co2PerKwh: 0.102     // kg CO2e per kWh — matches the case study (13,765 kWh ≈ 1.4 t)
};
