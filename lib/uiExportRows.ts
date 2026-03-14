// lib/uiExportRows.ts

export type PanelKey = "Input" | "Constraint" | "Ideal" | "Real" | "Brake";
export type UiRole = "input" | "readonly" | "derived" | "hidden";

export type UiExportRow = {
  panel_key: PanelKey;
  ui_role: UiRole;
  item_order: number;
  label: string;
  unit?: string;
  metric_key: string;
  value: number | string;
};

export const UI_EXPORT_ROWS: UiExportRow[] = [
  { panel_key: "Input", ui_role: "readonly", item_order: 1, label: "Volume Max V1", unit: "cc", metric_key: "V1_max_cc", value: 1000 },
  { panel_key: "Input", ui_role: "input", item_order: 2, label: "Compression Ratio", unit: "", metric_key: "CR", value: 100 },
  { panel_key: "Input", ui_role: "derived", item_order: 3, label: "Intake Pressure P1 (derived)", unit: "", metric_key: "P1_bar_derived", value: 1.2 },
  { panel_key: "Input", ui_role: "readonly", item_order: 4, label: "Temperature Input", unit: "°C", metric_key: "T1_C", value: 26.9 },
  { panel_key: "Input", ui_role: "input", item_order: 5, label: "Lambda", unit: "", metric_key: "lambda", value: 1.2 },
  { panel_key: "Input", ui_role: "derived", item_order: 6, label: "Volume Min V2", unit: "cc", metric_key: "V2_min_cc", value: 10 },
  { panel_key: "Input", ui_role: "derived", item_order: 7, label: "Heat in", unit: "J", metric_key: "Q_in_J", value: 4172 },
  { panel_key: "Input", ui_role: "hidden", item_order: 8, label: "Mass Water", unit: "", metric_key: "m_water_display", value: 0.44 },
  { panel_key: "Input", ui_role: "derived", item_order: 9, label: "Water Phase", unit: "", metric_key: "water_phase_result", value: "No Evaporation" },
  { panel_key: "Input", ui_role: "hidden", item_order: 10, label: "Water Fuel Ratio", unit: "", metric_key: "water_fuel_ratio", value: 4.68 },
  { panel_key: "Input", ui_role: "hidden", item_order: 11, label: "Compression Exponent n_comp", unit: "", metric_key: "gamma_comp_display", value: "1.05-1.20" },
  { panel_key: "Input", ui_role: "readonly", item_order: 12, label: "Loss Unburned", unit: "%", metric_key: "loss_unburned_pct", value: 1 },
  { panel_key: "Input", ui_role: "readonly", item_order: 13, label: "Loss Coolant Net", unit: "%", metric_key: "loss_coolant_pct", value: 10 },
  { panel_key: "Input", ui_role: "readonly", item_order: 14, label: "Mechanical efficiency", unit: "%", metric_key: "mech_eff_pct", value: 90 },
  { panel_key: "Input", ui_role: "input", item_order: 15, label: "Bore to Stroke Ratio", unit: "", metric_key: "bore_stroke_ratio", value: 1 },
  { panel_key: "Input", ui_role: "readonly", item_order: 16, label: "Combustion phasing (ATDC)θ Deg", unit: "deg", metric_key: "theta_deg", value: 5 },
  { panel_key: "Input", ui_role: "input", item_order: 17, label: "RPM", unit: "", metric_key: "rpm", value: 3600 },

  { panel_key: "Constraint", ui_role: "derived", item_order: 18, label: "End of Compression Temp T2", unit: "°C", metric_key: "T2_C", value: 298.5 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 19, label: "End of Compression Pressure P2", unit: "bar", metric_key: "P2_bar", value: 229 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 20, label: "Work Compression", unit: "J", metric_key: "W_comp_J", value: 776 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 21, label: "Compression Energy Fraction(CEF)", unit: "%", metric_key: "CEF", value: 18.6 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 22, label: "Compression/Expansion Work Ratio (Wcomp / Wexp)", unit: "%", metric_key: "CEWR", value: 20.7 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 23, label: "Effective Expansion Ratio (EER)", unit: "", metric_key: "EER", value: 80.51 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 24, label: "Peak Combustion Temp T3 (Real)", unit: "°C", metric_key: "T3_real_C", value: 2189.5 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 25, label: "Peak Combustion Pressure P3 (Real)", unit: "bar", metric_key: "P3_real_bar", value: 1199 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 26, label: "Peak Piston Force (F_max)", unit: "kN", metric_key: "F_max", value: 1099 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 27, label: "Latent Energy Fraction", unit: "%", metric_key: "LEF_pct", value: 6.6 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 28, label: "Loss Exhaust", unit: "J", metric_key: "Q_exh_real_bal_J", value: 1404 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 29, label: "Heat Unburned", unit: "J", metric_key: "Q_ub_J", value: 42 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 30, label: "Heat Friction", unit: "J", metric_key: "Q_fric_J", value: 268 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 31, label: "Cooling Heat (Gross)", unit: "J", metric_key: "Q_cool_gross_J", value: 413 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 32, label: "Recovered Heat (IHRL)", unit: "J", metric_key: "Q_rec_IHRL_J", value: 372 },
  { panel_key: "Constraint", ui_role: "derived", item_order: 33, label: "Cooling Heat (Net)", unit: "J", metric_key: "Q_cool_net_J", value: 41 },

  { panel_key: "Ideal", ui_role: "derived", item_order: 34, label: "Peak Combustion Temp T3 (Ideal)", unit: "°C", metric_key: "T3_ideal_C", value: 2394.7 },
  { panel_key: "Ideal", ui_role: "derived", item_order: 35, label: "Peak Combustion Pressure P3 (Ideal)", unit: "bar", metric_key: "P3_ideal_bar", value: 1299 },
  { panel_key: "Ideal", ui_role: "derived", item_order: 36, label: "Expansion Work (Ideal)", unit: "J", metric_key: "W_exp_ideal_J", value: 3745 },
  { panel_key: "Ideal", ui_role: "derived", item_order: 37, label: "Net Work (Ideal)", unit: "J", metric_key: "W_net_ideal_J", value: 2969 },
  { panel_key: "Ideal", ui_role: "derived", item_order: 38, label: "Thermal Efficiency (Ideal)", unit: "%", metric_key: "eta_th_ideal_pct", value: 71.2 },
  { panel_key: "Ideal", ui_role: "derived", item_order: 39, label: "IMEP (Ideal)", unit: "bar", metric_key: "IMEP_ideal_bar", value: 30 },

  { panel_key: "Real", ui_role: "derived", item_order: 40, label: "Pressure Exhaust", unit: "bar", metric_key: "P4_real_bar", value: 3 },
  { panel_key: "Real", ui_role: "derived", item_order: 41, label: "Temperature Exhaust", unit: "°C", metric_key: "T4_real_C", value: 287.5 },
  { panel_key: "Real", ui_role: "derived", item_order: 42, label: "Expansion Work (Real)", unit: "J", metric_key: "W_exp_real_J", value: 3461 },
  { panel_key: "Real", ui_role: "derived", item_order: 43, label: "Net Work(Real)", unit: "J", metric_key: "W_net_real_J", value: 2685 },
  { panel_key: "Real", ui_role: "derived", item_order: 44, label: "IMEP (Real)", unit: "bar", metric_key: "IMEP_real_bar", value: 27.18 },
  { panel_key: "Real", ui_role: "derived", item_order: 45, label: "Thermal Efficiency (Real)", unit: "%", metric_key: "eta_real_pct", value: 64.4 },

  { panel_key: "Brake", ui_role: "derived", item_order: 46, label: "Work Brake", unit: "J", metric_key: "W_brake_J", value: 2416 },
  { panel_key: "Brake", ui_role: "derived", item_order: 47, label: "Efficiency Brake", unit: "%", metric_key: "eta_brake_pct", value: 57.9 },
  { panel_key: "Brake", ui_role: "derived", item_order: 48, label: "BMEP", unit: "bar", metric_key: "BMEP_bar", value: 24 },
  { panel_key: "Brake", ui_role: "derived", item_order: 49, label: "Brake Power", unit: "KW", metric_key: "Power_brake_KW", value: 72 },
  { panel_key: "Brake", ui_role: "derived", item_order: 50, label: "Torque", unit: "Nm", metric_key: "torque_Nm", value: 192 },
  { panel_key: "Brake", ui_role: "derived", item_order: 51, label: "Mean Piston Speed", unit: "mps", metric_key: "mean_piston_speed_mps", value: 12.96 },
  { panel_key: "Brake", ui_role: "derived", item_order: 52, label: "BSFC g/kWh", unit: "g/kWh", metric_key: "bsfc_g_kWh", value: 141.27 },
  { panel_key: "Brake", ui_role: "derived", item_order: 53, label: "CO₂ Intensity (g/kWh)", unit: "g/kWh", metric_key: "co2_brake_g_kWh", value: 435.14 },
];