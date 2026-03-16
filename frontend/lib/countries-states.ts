// Defines the countries and states/provinces for address forms

export type CountryEntry = { name: string; code: string }; // Defines the country entry type
export type StatesForCountry = Record<string, string[]>; // Defines the states for country type
// Defines the US states
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming', 'District of Columbia',
];
// Defines the Canada provinces
const CANADA_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
  'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
  'Quebec', 'Saskatchewan', 'Yukon',
];
// Defines the UK countries
const UK_COUNTRIES = [
  'England', 'Scotland', 'Wales', 'Northern Ireland',
];
// Defines the Australia states
const AUSTRALIA_STATES = [
  'Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland',
  'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
];
// Defines the Germany states
const GERMANY_STATES = [
  'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hesse',
  'Lower Saxony', 'Mecklenburg-Vorpommern', 'North Rhine-Westphalia', 'Rhineland-Palatinate',
  'Saarland', 'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
];
// Defines the India states
const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
// Defines the Mexico states
const MEXICO_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo',
  'Jalisco', 'Mexico', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora',
  'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];
// Defines the Brazil states
const BRAZIL_STATES = [
  'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal',
  'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais',
  'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte',
  'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins',
];
// Defines the Japan prefectures
const JAPAN_PREFECTURES = [
  'Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima', 'Ibaraki',
  'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa', 'Niigata', 'Toyama',
  'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu', 'Shizuoka', 'Aichi', 'Mie',
  'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara', 'Wakayama', 'Tottori', 'Shimane',
  'Okayama', 'Hiroshima', 'Yamaguchi', 'Tokushima', 'Kagawa', 'Ehime', 'Kochi',
  'Fukuoka', 'Saga', 'Nagasaki', 'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa',
];

// Defines the states by country name
export const STATES_BY_COUNTRY: StatesForCountry = {
  'United States': US_STATES,
  'Canada': CANADA_PROVINCES,
  'United Kingdom': UK_COUNTRIES,
  'Australia': AUSTRALIA_STATES,
  'Germany': GERMANY_STATES,
  'India': INDIA_STATES,
  'Mexico': MEXICO_STATES,
  'Brazil': BRAZIL_STATES,
  'Japan': JAPAN_PREFECTURES,
};

// Defines the countries
export const COUNTRIES: CountryEntry[] = [
  { name: 'United States', code: 'US' },
  { name: 'Canada', code: 'CA' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'Australia', code: 'AU' },
  { name: 'Germany', code: 'DE' },
  { name: 'India', code: 'IN' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Japan', code: 'JP' },
  { name: 'France', code: 'FR' },
  { name: 'Italy', code: 'IT' },
  { name: 'Spain', code: 'ES' },
  { name: 'Netherlands', code: 'NL' },
  { name: 'Ireland', code: 'IE' },
  { name: 'New Zealand', code: 'NZ' },
  { name: 'South Africa', code: 'ZA' },
  { name: 'China', code: 'CN' },
  { name: 'South Korea', code: 'KR' },
  { name: 'Philippines', code: 'PH' },
  { name: 'Indonesia', code: 'ID' },
  { name: 'Singapore', code: 'SG' },
  { name: 'Malaysia', code: 'MY' },
  { name: 'Thailand', code: 'TH' },
  { name: 'Vietnam', code: 'VN' },
  { name: 'Argentina', code: 'AR' },
  { name: 'Chile', code: 'CL' },
  { name: 'Colombia', code: 'CO' },
  { name: 'Peru', code: 'PE' },
  { name: 'Sweden', code: 'SE' },
  { name: 'Norway', code: 'NO' },
  { name: 'Denmark', code: 'DK' },
  { name: 'Finland', code: 'FI' },
  { name: 'Poland', code: 'PL' },
  { name: 'Belgium', code: 'BE' },
  { name: 'Austria', code: 'AT' },
  { name: 'Switzerland', code: 'CH' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Greece', code: 'GR' },
  { name: 'Turkey', code: 'TR' },
  { name: 'Israel', code: 'IL' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'Egypt', code: 'EG' },
  { name: 'Nigeria', code: 'NG' },
  { name: 'Kenya', code: 'KE' },
  { name: 'Pakistan', code: 'PK' },
  { name: 'Bangladesh', code: 'BD' },
  { name: 'Russia', code: 'RU' },
  { name: 'Ukraine', code: 'UA' },
  { name: 'Czech Republic', code: 'CZ' },
  { name: 'Romania', code: 'RO' },
  { name: 'Hungary', code: 'HU' },
  { name: 'Other', code: 'XX' },
];
// Defines the get country names function
export function getCountryNames(): string[] {
  return COUNTRIES.map((c) => c.name); // Returns the country names
}
// Defines the get states for country function
export function getStatesForCountry(countryName: string): string[] {
  return STATES_BY_COUNTRY[countryName] ?? []; // Returns the states for the country
}
// Defines the country has states function
export function countryHasStates(countryName: string): boolean {
  return (STATES_BY_COUNTRY[countryName]?.length ?? 0) > 0; // Returns true if the country has states, false otherwise
}
