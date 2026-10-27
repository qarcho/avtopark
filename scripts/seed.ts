/**
 * Demo data: one company "Demo Rent" with the same cars, customers, bookings and
 * fines as reference/avtopark-demo.html, with dates relative to today.
 *
 *   npm run db:seed
 *
 * Creates three logins (password = SEED_DEMO_PASSWORD in .env.local):
 *   demo-owner@avtopark.test, demo-manager@avtopark.test, demo-operator@avtopark.test
 *
 * Safe to run again: it deletes the previous Demo Rent company first.
 * Never run against a database with real customers.
 */
import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { addDays, todayInTbilisi } from "../src/lib/dates";

config({ path: ".env.local", quiet: true });

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is missing in .env.local`);
  return v;
};

const DEMO_SLUG = "demo-rent";
const USERS = [
  { email: "demo-owner@avtopark.test", name: "გიორგი დემო", role: "owner" },
  { email: "demo-manager@avtopark.test", name: "ნინო მენეჯერი", role: "manager" },
  { email: "demo-operator@avtopark.test", name: "ლაშა ოპერატორი", role: "operator" },
] as const;

type Cls = "economy" | "compact" | "suv" | "offroad" | "van" | "premium";
// plate, make, model, year, class, rate, transmission, fuel, color, km, km since oil change, insurance days left, inspection days left
const CARS: [string, string, string, number, Cls, number, string, string, string, number, number, number, number][] = [
  ["TP-416-RA", "Toyota", "Prius", 2016, "economy", 80, "automatic", "hybrid", "#C9CED6", 186400, 7200, 90, 200],
  ["HE-208-LT", "Hyundai", "Elantra", 2019, "compact", 100, "automatic", "petrol", "#2A3140", 98200, 4100, 12, 160],
  ["TC-731-GE", "Toyota", "Corolla", 2020, "compact", 110, "automatic", "petrol", "#EEF0F2", 72400, 3300, 150, 240],
  ["KS-552-OR", "Kia", "Sportage", 2021, "suv", 150, "automatic", "petrol", "#8B1E2B", 54100, 2600, 210, 20],
  ["RV-904-TB", "Toyota", "RAV4", 2019, "suv", 160, "automatic", "hybrid", "#3B5B7A", 88700, 5200, 180, 260],
  ["MD-117-KZ", "Mitsubishi", "Delica", 2008, "van", 180, "automatic", "diesel", "#D9D2C3", 241300, 10500, 95, 140],
  ["ME-300-VP", "Mercedes-Benz", "E 220", 2018, "premium", 280, "automatic", "diesel", "#151A22", 112900, 1200, 240, 300],
  ["LP-650-SV", "Toyota", "Land Cruiser Prado", 2017, "offroad", 250, "automatic", "diesel", "#6B6F73", 158300, 6100, 130, -5],
  ["HT-389-BT", "Hyundai", "Tucson", 2020, "suv", 140, "automatic", "petrol", "#2F4F3E", 76500, 8200, 170, 200],
  ["NX-725-KT", "Nissan", "X-Trail", 2019, "suv", 150, "manual", "petrol", "#E5E7EB", 102800, 2900, 60, 110],
];
const DEPOSIT: Record<Cls, number> = { economy: 300, compact: 300, suv: 500, offroad: 800, van: 500, premium: 1000 };
const IN_SERVICE = "ME-300-VP";

type Loc = "tbs" | "kut" | "bus" | "office";
// car plate, start offset from today, length in days, customer, phone, country, pickup location
const BOOKINGS: [string, number, number, string, string, string, Loc][] = [
  ["KS-552-OR", -40, 5, "Rustam Kerimov", "+994 55 210 77 41", "AZ", "tbs"],
  ["TP-416-RA", -14, 6, "Kenji Sato", "+81 90 4412 7781", "JP", "tbs"],
  ["TP-416-RA", -6, 4, "Anna Kowalska", "+48 512 334 901", "PL", "tbs"],
  ["TP-416-RA", 0, 5, "ლევან კაპანაძე", "+995 599 12 34 56", "GE", "office"],
  ["TP-416-RA", 7, 6, "Yusuf Demir", "+90 532 418 22 10", "TR", "kut"],
  ["HE-208-LT", -3, 3, "Sophie Martin", "+33 6 12 48 90 31", "FR", "tbs"],
  ["HE-208-LT", 2, 7, "Ivan Petrov", "+7 916 220 45 18", "RU", "tbs"],
  ["TC-731-GE", -12, 8, "Oliver Brown", "+44 7700 900412", "GB", "tbs"],
  ["TC-731-GE", -2, 6, "Lior Cohen", "+972 54 771 3302", "IL", "tbs"],
  ["TC-731-GE", 6, 4, "ნინო ბერიძე", "+995 577 80 21 44", "GE", "office"],
  ["KS-552-OR", -8, 5, "Elif Yılmaz", "+90 541 220 18 47", "TR", "kut"],
  ["KS-552-OR", 1, 9, "Ahmed Al-Mansoori", "+971 50 384 1176", "AE", "tbs"],
  ["RV-904-TB", -11, 7, "Lukas Weber", "+49 160 4412 908", "DE", "tbs"],
  ["RV-904-TB", -1, 8, "Emma Schmidt", "+49 151 2238 4410", "DE", "kut"],
  ["MD-117-KZ", -4, 4, "Daniel Novák", "+420 603 118 552", "CZ", "bus"],
  ["MD-117-KZ", 5, 10, "Marta Nowak", "+48 601 220 118", "PL", "bus"],
  ["ME-300-VP", 9, 3, "Rashid Karimov", "+994 50 312 44 87", "AZ", "tbs"],
  ["LP-650-SV", -5, 12, "Ali Hassan", "+966 55 410 2283", "SA", "tbs"],
  ["HT-389-BT", -9, 5, "Mia Jensen", "+45 22 41 88 09", "DK", "tbs"],
  ["HT-389-BT", 4, 3, "Giulia Rossi", "+39 347 552 1904", "IT", "tbs"],
  ["HT-389-BT", 10, 5, "Tomasz Wiśniewski", "+48 509 774 230", "PL", "kut"],
  ["NX-725-KT", -10, 6, "Sara Lindqvist", "+46 70 512 33 81", "SE", "bus"],
  ["NX-725-KT", 0, 3, "გიორგი მაისურაძე", "+995 595 44 10 87", "GE", "tbs"],
  ["NX-725-KT", 12, 6, "Hannah Lee", "+82 10 3348 2291", "KR", "tbs"],
];
const EXTRAS = [{}, { full_insurance: true }, { extra_driver: true }, {}, { full_insurance: true, child_seats: 1 }, {}, { hotel_delivery: true }, { full_insurance: true }];

async function main() {
  const databaseUrl = need("DATABASE_URL");
  const password = need("SEED_DEMO_PASSWORD");
  if (password.length < 10) throw new Error("SEED_DEMO_PASSWORD must be at least 10 characters");
  const admin = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });
  const today = todayInTbilisi();
  const d = (offset: number) => addDays(today, offset);

  try {
    // 1. Demo logins (created or reset to the demo password).
    const userIds: Record<string, string> = {};
    for (const u of USERS) {
      const [existing] = await sql`select id from auth.users where lower(email) = ${u.email}`;
      if (existing) {
        const { error } = await admin.auth.admin.updateUserById(existing.id, { password, user_metadata: { full_name: u.name } });
        if (error) throw error;
        await sql`update public.profiles set full_name = ${u.name} where user_id = ${existing.id}`;
        userIds[u.email] = existing.id;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: u.name },
        });
        if (error || !data.user) throw error ?? new Error("createUser failed");
        userIds[u.email] = data.user.id;
      }
    }

    await sql.begin(async (tx) => {
      // 2. Fresh company (deleting cascades to all its data).
      await tx`delete from public.organizations where slug = ${DEMO_SLUG}`;
      const [org] = await tx`
        insert into public.organizations (name, slug, legal_name, legal_id, legal_address, phone, email)
        values ('Demo Rent', ${DEMO_SLUG}, 'შპს დემო რენტი / Demo Rent LLC', '405000000',
                'თბილისი, რუსთაველის გამზ. 1 / 1 Rustaveli Ave, Tbilisi', '+995 32 200 00 00', 'info@demorent.ge')
        returning id`;
      const orgId: string = org.id;

      for (const u of USERS) {
        await tx`insert into public.memberships (organization_id, user_id, role) values (${orgId}, ${userIds[u.email]}, ${u.role})`;
      }

      // 3. Locations were created by the database; map them to the demo's codes.
      const locs = await tx`select id, sort_order from public.locations where organization_id = ${orgId}`;
      const locId: Record<Loc, string> = {
        tbs: locs.find((l) => l.sort_order === 1)!.id,
        kut: locs.find((l) => l.sort_order === 2)!.id,
        bus: locs.find((l) => l.sort_order === 3)!.id,
        office: locs.find((l) => l.sort_order === 4)!.id,
      };

      // 4. Cars.
      const carId: Record<string, string> = {};
      const carRate: Record<string, number> = {};
      const carDeposit: Record<string, number> = {};
      for (const [plate, make, model, year, cls, rate, trans, fuel, color, km, oilAgo, ins, insp] of CARS) {
        const [v] = await tx`
          insert into public.vehicles (organization_id, plate, make, model, year, vehicle_class, transmission, fuel_type, color,
            daily_rate, deposit, odometer_km, last_oil_change_km, oil_interval_km, insurance_valid_until, inspection_valid_until, in_service)
          values (${orgId}, ${plate}, ${make}, ${model}, ${year}, ${cls}, ${trans}, ${fuel}, ${color},
            ${rate}, ${DEPOSIT[cls]}, ${km}, ${km - oilAgo}, 10000, ${d(ins)}, ${d(insp)}, ${plate === IN_SERVICE})
          returning id`;
        carId[plate] = v.id;
        carRate[plate] = rate;
        carDeposit[plate] = DEPOSIT[cls];
      }

      // 5. Customers.
      const customerId: Record<string, string> = {};
      const addCustomer = async (name: string, phone: string, country: string, docs: boolean) => {
        if (customerId[name]) return customerId[name];
        const [c] = await tx`
          insert into public.customers (organization_id, full_name, phone, country, license_verified, passport_verified)
          values (${orgId}, ${name}, ${phone}, ${country}, ${docs}, ${docs}) returning id`;
        customerId[name] = c.id;
        return c.id as string;
      };

      const extraPrices = { extra_driver_per_day: 15, child_seat_per_day: 10, full_insurance_per_day: 25, hotel_delivery_fee: 30 };

      // 6. Bookings, in the demo's order so numbers match (B-1041 ...).
      const bookingIds: Record<string, string> = {};
      for (const [i, [plate, off, len, name, phone, country, loc]] of BOOKINGS.entries()) {
        const cust = await addCustomer(name, phone, country, i % 5 !== 3);
        const ex = { extra_driver: false, child_seats: 0, full_insurance: false, hotel_delivery: false, ...EXTRAS[i % 8] };
        const start = d(off);
        const end = d(off + len);
        // Past and current rentals: deposit taken; finished ones returned.
        const deposit_status = end < today ? "returned" : off < 0 ? "held" : "none";
        const [b] = await tx`
          insert into public.bookings (organization_id, customer_id, pickup_date, return_date, pickup_location_id, daily_rate,
            extra_prices, extra_driver, child_seats, full_insurance, hotel_delivery, hotel_address, status, source,
            deposit_amount, deposit_status)
          values (${orgId}, ${cust}, ${start}, ${end}, ${locId[loc]}, ${carRate[plate]},
            ${tx.json(extraPrices)}, ${ex.extra_driver}, ${ex.child_seats}, ${ex.full_insurance}, ${ex.hotel_delivery},
            ${ex.hotel_delivery ? "Rooms Hotel, Kostava St 14" : null}, 'confirmed', 'desk',
            ${carDeposit[plate]}, ${deposit_status})
          returning id`;
        bookingIds[name] = b.id;
        // Lukas Weber's RAV4 broke down; he got the Elantra for the rest of the rental (see the demo).
        if (name === "Lukas Weber") {
          await tx`insert into public.booking_segments (organization_id, booking_id, vehicle_id, start_date, end_date)
                   values (${orgId}, ${b.id}, ${carId["RV-904-TB"]}, ${start}, ${d(-9)}),
                          (${orgId}, ${b.id}, ${carId["HE-208-LT"]}, ${d(-9)}, ${end})`;
        } else {
          await tx`insert into public.booking_segments (organization_id, booking_id, vehicle_id, start_date, end_date)
                   values (${orgId}, ${b.id}, ${carId[plate]}, ${start}, ${end})`;
        }
      }

      // Rustam returned the Sportage with hidden damage: deposit partly withheld, blacklisted.
      await tx`update public.bookings set deposit_status = 'withheld', deposit_withheld = 250 where id = ${bookingIds["Rustam Kerimov"]}`;
      await tx`update public.customers set blacklisted = true,
                 blacklist_reason = 'დაბრუნდა დაფარული დაზიანებით, ანაზღაურებაზე უარი თქვა / Returned with hidden damage, refused to pay'
               where id = ${customerId["Rustam Kerimov"]}`;

      // 7. Two online requests waiting for confirmation (they already block the car).
      const requests: [string, number, number, string, string, string, boolean, Loc, object, string | null][] = [
        ["TC-731-GE", 11, 4, "Mateo García", "+34 612 448 190", "ES", true, "tbs", { extra_driver: true, child_seats: 1, full_insurance: true }, null],
        ["MD-117-KZ", 16, 3, "Chen Wei", "+86 138 0013 5521", "CN", false, "bus", { full_insurance: true, hotel_delivery: true }, "Hilton Batumi"],
      ];
      for (const [plate, off, len, name, phone, country, docs, loc, extras, hotel] of requests) {
        const cust = await addCustomer(name, phone, country, docs);
        const ex = { extra_driver: false, child_seats: 0, full_insurance: false, hotel_delivery: false, ...extras };
        const [b] = await tx`
          insert into public.bookings (organization_id, customer_id, pickup_date, return_date, pickup_location_id, daily_rate,
            extra_prices, extra_driver, child_seats, full_insurance, hotel_delivery, hotel_address, status, source, deposit_amount)
          values (${orgId}, ${cust}, ${d(off)}, ${d(off + len)}, ${locId[loc]}, ${carRate[plate]},
            ${tx.json(extraPrices)}, ${ex.extra_driver}, ${ex.child_seats}, ${ex.full_insurance}, ${ex.hotel_delivery},
            ${hotel}, 'request', 'online', ${carDeposit[plate]})
          returning id`;
        await tx`insert into public.booking_segments (organization_id, booking_id, vehicle_id, start_date, end_date)
                 values (${orgId}, ${b.id}, ${carId[plate]}, ${d(off)}, ${d(off + len)})`;
      }

      // 8. Fines (matched to bookings in the Fines phase).
      const fines: [string, number, string, string, number, string, string][] = [
        ["TC-731-GE", -1, "14:32", "speeding", 50, "კახეთის გზატკეცილი / Kakheti Highway", "new"],
        ["LP-650-SV", -3, "11:05", "parking", 30, "ჭავჭავაძის გამზ., თბილისი / Chavchavadze Ave, Tbilisi", "assigned"],
        ["TP-416-RA", -5, "19:47", "speeding", 50, "რუსთაველის გამზ., თბილისი / Rustaveli Ave, Tbilisi", "paid"],
        ["HT-389-BT", -2, "09:10", "lane", 100, "აღმაშენებლის ხეივანი / Agmashenebeli Alley", "new"],
      ];
      for (const [plate, off, time, violation, amount, place, status] of fines) {
        await tx`insert into public.fines (organization_id, vehicle_id, occurred_at, violation, place, amount, status)
                 values (${orgId}, ${carId[plate]}, ${`${d(off)}T${time}:00+04:00`}, ${violation}, ${place}, ${amount}, ${status})`;
      }
    });

    console.log("Demo data ready: company 'Demo Rent' with 10 cars, 26 bookings and 4 fines.");
    console.log("Logins:", USERS.map((u) => `${u.email} (${u.role})`).join(", "));
    console.log("Password: the SEED_DEMO_PASSWORD value in .env.local");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
