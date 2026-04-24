export const cadFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

export const cadFormatterWhole = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

export const formatCAD = (n: number | string | null | undefined): string =>
  cadFormatter.format(Number(n) || 0);

export const formatCADWhole = (n: number | string | null | undefined): string =>
  cadFormatterWhole.format(Number(n) || 0);
