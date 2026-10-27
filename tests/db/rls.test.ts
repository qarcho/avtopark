import { afterAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsAnon,
  actAsSystem,
  addBooking,
  addCustomer,
  addVehicle,
  createOrg,
  createUser,
  expectDbError,
  hasDatabase,
  inRollback,
  sql,
  twoCompanies,
} from "./helpers";

afterAll(async () => {
  if (hasDatabase) await sql.end();
});

describe.skipIf(!hasDatabase)("tenant isolation (one company never sees another)", () => {
  it("a member only sees their own company's data", async () => {
    await inRollback(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      for (const table of ["vehicles", "customers", "bookings", "booking_segments", "locations", "organization_settings"]) {
        const rows = await tx`select organization_id from ${tx("public." + table)}`;
        expect(rows.length, table).toBeGreaterThan(0);
        expect(rows.every((r) => r.organization_id === a.org), table).toBe(true);
      }
      const orgs = await tx`select id from public.organizations`;
      expect(orgs.map((o) => o.id)).toEqual([a.org]);
      const other = await tx`select id from public.customers where id = ${b.customer}`;
      expect(other).toHaveLength(0);
    });
  });

  it("cannot change or delete another company's rows", async () => {
    await inRollback(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      await actAs(tx, a.owner);
      const upd = await tx`update public.vehicles set odometer_km = 1 where id = ${b.vehicle} returning id`;
      expect(upd).toHaveLength(0);
      const del = await tx`delete from public.customers where id = ${b.customer} returning id`;
      expect(del).toHaveLength(0);
      await actAsSystem(tx);
      const [v] = await tx`select odometer_km from public.vehicles where id = ${b.vehicle}`;
      expect(v.odometer_km).toBe(0);
    });
  });

  it("cannot insert rows into another company", async () => {
    await inRollback(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      await actAs(tx, a.owner);
      await expectDbError(tx, (sp) => addVehicle(sp, b.org, "XX-999-XX"), /row-level security/);
      await expectDbError(tx, (sp) => addCustomer(sp, b.org), /row-level security/);
    });
  });

  it("a booking cannot point at another company's customer or car", async () => {
    await inRollback(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      await actAs(tx, a.owner);
      await expectDbError(tx, (sp) => addBooking(sp, a.org, b.customer, a.vehicle, "2030-06-01", "2030-06-03"), /foreign key/);
      await expectDbError(tx, (sp) => addBooking(sp, a.org, a.customer, b.vehicle, "2030-06-01", "2030-06-03"), /foreign key/);
    });
  });

  it("staff of one company cannot add themselves to another company", async () => {
    await inRollback(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      await actAs(tx, a.owner);
      await expectDbError(
        tx,
        (sp) => sp`insert into public.memberships (organization_id, user_id, role) values (${b.org}, ${a.owner}, 'owner')`,
        /row-level security/,
      );
    });
  });

  it("logged-out visitors see nothing", async () => {
    await inRollback(async (tx) => {
      await twoCompanies(tx);
      await actAsAnon(tx);
      await expectDbError(tx, (sp) => sp`select * from public.customers`, /permission denied/);
      await expectDbError(tx, (sp) => sp`select * from public.organizations`, /permission denied/);
    });
  });

  it("the platform admin sees companies but not their cars, customers or bookings", async () => {
    await inRollback(async (tx) => {
      await twoCompanies(tx);
      const admin = await createUser(tx, "Admin");
      await tx`insert into public.platform_admins (user_id) values (${admin})`;
      await actAs(tx, admin);
      const orgs = await tx`select id from public.organizations`;
      expect(orgs.length).toBeGreaterThanOrEqual(2);
      expect(await tx`select id from public.vehicles`).toHaveLength(0);
      expect(await tx`select id from public.customers`).toHaveLength(0);
      expect(await tx`select id from public.bookings`).toHaveLength(0);
    });
  });
});

describe.skipIf(!hasDatabase)("roles: operator vs manager", () => {
  it("operators cannot add cars; managers can", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      await expectDbError(tx, (sp) => addVehicle(sp, a.org, "OP-123-OP"), /row-level security/);
      await actAs(tx, a.manager);
      await addVehicle(tx, a.org, "MG-123-MG");
    });
  });

  it("operators can update a car but not its price or deposit", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      const ok = await tx`update public.vehicles set odometer_km = 1234, in_service = true where id = ${a.vehicle} returning id`;
      expect(ok).toHaveLength(1);
      await expectDbError(tx, (sp) => sp`update public.vehicles set daily_rate = 1 where id = ${a.vehicle}`, /only managers/);
      await expectDbError(tx, (sp) => sp`update public.vehicles set deposit = 0 where id = ${a.vehicle}`, /only managers/);
      await actAs(tx, a.manager);
      const m = await tx`update public.vehicles set daily_rate = 95 where id = ${a.vehicle} returning id`;
      expect(m).toHaveLength(1);
    });
  });

  it("operators cannot change booking rate or deposit", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      const ok = await tx`update public.bookings set note = 'late flight' where id = ${a.booking.id} returning id`;
      expect(ok).toHaveLength(1);
      await expectDbError(tx, (sp) => sp`update public.bookings set daily_rate = 1 where id = ${a.booking.id}`, /only managers/);
      await expectDbError(tx, (sp) => sp`update public.bookings set deposit_amount = 0 where id = ${a.booking.id}`, /only managers/);
      await actAs(tx, a.manager);
      await tx`update public.bookings set deposit_amount = 500 where id = ${a.booking.id}`;
    });
  });

  it("operators cannot delete; managers can", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      expect(await tx`delete from public.bookings where id = ${a.booking.id} returning id`).toHaveLength(0);
      expect(await tx`delete from public.vehicles where id = ${a.vehicle} returning id`).toHaveLength(0);
      await actAs(tx, a.manager);
      expect(await tx`delete from public.bookings where id = ${a.booking.id} returning id`).toHaveLength(1);
    });
  });

  it("only managers can blacklist a customer", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      await expectDbError(
        tx,
        (sp) => sp`update public.customers set blacklisted = true, blacklist_reason = 'x' where id = ${a.customer}`,
        /only managers/,
      );
      await expectDbError(
        tx,
        (sp) => sp`insert into public.customers (organization_id, full_name, blacklisted, blacklist_reason) values (${a.org}, 'X', true, 'x')`,
        /only managers/,
      );
      await actAs(tx, a.manager);
      await tx`update public.customers set blacklisted = true, blacklist_reason = 'Returned with hidden damage' where id = ${a.customer}`;
    });
  });

  it("operators cannot change company settings or prices in settings", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      expect(await tx`update public.organization_settings set fuel_fee_per_eighth = 1 where organization_id = ${a.org} returning 1`).toHaveLength(0);
      await actAs(tx, a.manager);
      expect(await tx`update public.organization_settings set fuel_fee_per_eighth = 30 where organization_id = ${a.org} returning 1`).toHaveLength(1);
    });
  });

  it("operators cannot invite staff; managers cannot create owners; owners can", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      const newbie = await createUser(tx, "New");
      await actAs(tx, a.operator);
      await expectDbError(tx, (sp) => sp`insert into public.memberships values (${a.org}, ${newbie}, 'operator')`, /row-level security/);
      await actAs(tx, a.manager);
      await expectDbError(tx, (sp) => sp`insert into public.memberships values (${a.org}, ${newbie}, 'owner')`, /row-level security/);
      await tx`insert into public.memberships (organization_id, user_id, role) values (${a.org}, ${newbie}, 'operator')`;
      await expectDbError(tx, (sp) => sp`update public.memberships set role = 'owner' where user_id = ${newbie} and organization_id = ${a.org}`, /row-level security/);
      await actAs(tx, a.owner);
      await tx`update public.memberships set role = 'manager' where user_id = ${newbie} and organization_id = ${a.org}`;
    });
  });

  it("a company always keeps at least one owner", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await expectDbError(tx, (sp) => sp`delete from public.memberships where user_id = ${a.owner} and organization_id = ${a.org}`, /at least one owner/);
      await expectDbError(tx, (sp) => sp`update public.memberships set role = 'manager' where user_id = ${a.owner} and organization_id = ${a.org}`, /at least one owner/);
    });
  });

  it("only managers can read the audit log, and only their own company's", async () => {
    await inRollback(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      await actAs(tx, b.manager);
      await tx`update public.bookings set deposit_amount = 450 where id = ${b.booking.id}`;
      await actAs(tx, a.manager);
      await tx`update public.bookings set deposit_amount = 400 where id = ${a.booking.id}`;
      const rows = await tx`select organization_id, actor_id, action, changes from public.audit_log`;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organization_id === a.org)).toBe(true);
      const change = rows.find((r) => r.action === "UPDATE" && r.changes.deposit_amount);
      expect(change?.actor_id).toBe(a.manager);
      expect(change?.changes.deposit_amount).toEqual({ old: 300, new: 400 });
      await actAs(tx, a.operator);
      expect(await tx`select id from public.audit_log`).toHaveLength(0);
      await expectDbError(tx, (sp) => sp`insert into public.audit_log (organization_id, table_name, record_id, action, changes) values (${a.org}, 'x', ${a.org}, 'INSERT', '{}')`, /permission denied/);
    });
  });
});

describe.skipIf(!hasDatabase)("bookings in the database", () => {
  it("never allows two overlapping bookings for the same car", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx); // booked 2030-05-01 → 2030-05-05
      await actAs(tx, a.operator);
      const c = await addCustomer(tx, a.org, "Ivan Petrov");
      await expectDbError(tx, (sp) => addBooking(sp, a.org, c, a.vehicle, "2030-05-04", "2030-05-08"), /booking_segments_no_overlap/);
      await expectDbError(tx, (sp) => addBooking(sp, a.org, c, a.vehicle, "2030-04-28", "2030-05-02"), /booking_segments_no_overlap/);
    });
  });

  it("allows same-day turnover: returned on the 5th, out again on the 5th", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      const c = await addCustomer(tx, a.org, "Ivan Petrov");
      await addBooking(tx, a.org, c, a.vehicle, "2030-05-05", "2030-05-08");
      await addBooking(tx, a.org, c, a.vehicle, "2030-04-28", "2030-05-01");
    });
  });

  it("online requests block the dates; cancelling frees them", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      await actAs(tx, a.operator);
      const c = await addCustomer(tx, a.org, "Mateo García");
      const req = await addBooking(tx, a.org, c, a.vehicle, "2030-07-01", "2030-07-04", "request");
      await expectDbError(tx, (sp) => addBooking(sp, a.org, c, a.vehicle, "2030-07-02", "2030-07-03"), /booking_segments_no_overlap/);
      await tx`update public.bookings set status = 'cancelled' where id = ${req.id}`;
      await addBooking(tx, a.org, c, a.vehicle, "2030-07-02", "2030-07-03");
    });
  });

  it("numbers bookings per company starting at B-1041", async () => {
    await inRollback(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      expect(a.booking.number).toBe(1041);
      expect(b.booking.number).toBe(1041);
      const c = await addCustomer(tx, a.org);
      const v = await addVehicle(tx, a.org, "AB-123-CD");
      const next = await addBooking(tx, a.org, c, v, "2030-01-01", "2030-01-02");
      expect(next.number).toBe(1042);
    });
  });

  it("rejects a return date that is not after the pickup date", async () => {
    await inRollback(async (tx) => {
      const { a } = await twoCompanies(tx);
      const c = await addCustomer(tx, a.org);
      await expectDbError(tx, (sp) => addBooking(sp, a.org, c, a.vehicle, "2030-09-05", "2030-09-05"), /check/);
    });
  });

  it("rejects badly formatted plates", async () => {
    await inRollback(async (tx) => {
      const org = await createOrg(tx, "plates");
      await expectDbError(tx, (sp) => addVehicle(sp, org, "aa-123-bb"), /check/);
      await expectDbError(tx, (sp) => addVehicle(sp, org, "AA123BB"), /check/);
    });
  });
});

describe.skipIf(!hasDatabase)("new company defaults", () => {
  it("creates settings with default prices and the four usual locations", async () => {
    await inRollback(async (tx) => {
      const org = await createOrg(tx, "defaults");
      const [s] = await tx`select * from public.organization_settings where organization_id = ${org}`;
      expect(Number(s.extra_driver_per_day)).toBe(15);
      expect(Number(s.fuel_fee_per_eighth)).toBe(25);
      expect(Number(s.deposit_offroad)).toBe(800);
      const locs = await tx`select name_en from public.locations where organization_id = ${org} order by sort_order`;
      expect(locs.map((l) => l.name_en)).toEqual(["Tbilisi Airport", "Kutaisi Airport", "Batumi Airport", "Tbilisi office"]);
    });
  });
});

describe.skipIf(!hasDatabase)("deleting a company", () => {
  it("removes all its data, and only its data", async () => {
    await inRollback(async (tx) => {
      const { a, b } = await twoCompanies(tx);
      await tx`update public.bookings set deposit_amount = 350 where id = ${a.booking.id}`;
      await tx`insert into public.fines (organization_id, vehicle_id, occurred_at, violation, amount, booking_id)
               values (${a.org}, ${a.vehicle}, now(), 'speeding', 50, ${a.booking.id})`;
      await tx`delete from public.organizations where id = ${a.org}`;
      for (const table of ["vehicles", "customers", "bookings", "booking_segments", "fines", "memberships", "audit_log"]) {
        const [left] = await tx`select count(*)::int as n from ${tx("public." + table)} where organization_id = ${a.org}`;
        expect(left.n, table).toBe(0);
      }
      const [other] = await tx`select count(*)::int as n from public.bookings where organization_id = ${b.org}`;
      expect(other.n).toBe(1);
    });
  });
});

describe.skipIf(!hasDatabase)("rate limiting", () => {
  it("allows up to the limit, then refuses", async () => {
    await inRollback(async (tx) => {
      const key = `test:${crypto.randomUUID()}`;
      const results = [];
      for (let i = 0; i < 4; i++) {
        const [r] = await tx`select public.hit_rate_limit(${key}, 3, 60) as ok`;
        results.push(r.ok);
      }
      expect(results).toEqual([true, true, true, false]);
    });
  });

  it("app users cannot call it directly", async () => {
    await inRollback(async (tx) => {
      const u = await createUser(tx);
      await actAs(tx, u);
      await expectDbError(tx, (sp) => sp`select public.hit_rate_limit('x', 1, 60)`, /permission denied/);
    });
  });
});
