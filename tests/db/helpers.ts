import postgres from "postgres";

// Database security tests run against the real Supabase database (DATABASE_URL).
// Every test runs inside a transaction that is always rolled back, so nothing is left behind.

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const sql = hasDatabase
  ? postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} })
  : (null as unknown as postgres.Sql);

export type Tx = postgres.TransactionSql;

class Rollback extends Error {}

/** Runs `fn` in a transaction and rolls it back afterwards. */
export async function inRollback(fn: (tx: Tx) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

/** Acts as a logged-in app user, exactly like a request through the Supabase API. */
export async function actAs(tx: Tx, userId: string) {
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
  await tx`set local role authenticated`;
}

export async function actAsAnon(tx: Tx) {
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: "anon" })}, true)`;
  await tx`set local role anon`;
}

/** Back to the database owner (used to set up data). */
export async function actAsSystem(tx: Tx) {
  await tx`reset role`;
  await tx`select set_config('request.jwt.claims', '', true)`;
}

/** Expects the statement to fail; runs it in a savepoint so the transaction stays usable. */
export async function expectDbError(tx: Tx, fn: (sp: Tx) => Promise<unknown>, pattern?: RegExp) {
  let error: unknown = null;
  try {
    await tx.savepoint(async (sp) => {
      await fn(sp as unknown as Tx);
    });
  } catch (e) {
    error = e;
  }
  if (!error) throw new Error("expected a database error, but the statement succeeded");
  if (pattern && !pattern.test(String((error as Error).message))) {
    throw new Error(`expected error matching ${pattern}, got: ${(error as Error).message}`);
  }
}

let n = 0;
const uid = () => crypto.randomUUID();

export async function createUser(tx: Tx, name = "Test User") {
  const id = uid();
  n += 1;
  await tx`
    insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values (${id}, ${`rls-test-${id}@avtopark.test`}, 'authenticated', 'authenticated',
            ${tx.json({ full_name: `${name} ${n}` })})`;
  return id;
}

export async function createOrg(tx: Tx, slug: string) {
  const [org] = await tx`
    insert into public.organizations (name, slug) values (${slug}, ${`${slug}-${uid().slice(0, 8)}`})
    returning id`;
  return org.id as string;
}

export async function addMember(tx: Tx, orgId: string, userId: string, role: "owner" | "manager" | "operator") {
  await tx`insert into public.memberships (organization_id, user_id, role) values (${orgId}, ${userId}, ${role})`;
}

export async function addVehicle(tx: Tx, orgId: string, plate: string) {
  const [v] = await tx`
    insert into public.vehicles (organization_id, plate, make, model, year, vehicle_class, transmission, fuel_type, daily_rate, deposit)
    values (${orgId}, ${plate}, 'Toyota', 'Prius', 2016, 'economy', 'automatic', 'hybrid', 80, 300)
    returning id`;
  return v.id as string;
}

export async function addCustomer(tx: Tx, orgId: string, name = "Anna Kowalska") {
  const [c] = await tx`
    insert into public.customers (organization_id, full_name, phone, country)
    values (${orgId}, ${name}, '+48 512 334 901', 'PL') returning id`;
  return c.id as string;
}

export async function addBooking(
  tx: Tx,
  orgId: string,
  customerId: string,
  vehicleId: string,
  pickup: string,
  ret: string,
  status: "request" | "confirmed" | "cancelled" = "confirmed",
) {
  const [b] = await tx`
    insert into public.bookings (organization_id, customer_id, pickup_date, return_date, daily_rate, status, deposit_amount)
    values (${orgId}, ${customerId}, ${pickup}, ${ret}, 80, ${status}, 300) returning id, number`;
  await tx`
    insert into public.booking_segments (organization_id, booking_id, vehicle_id, start_date, end_date, blocks)
    values (${orgId}, ${b.id}, ${vehicleId}, ${pickup}, ${ret}, ${status !== "cancelled"})`;
  return { id: b.id as string, number: b.number as number };
}

/** Two companies, each with an owner, a manager and an operator, a car, a customer and a booking. */
export async function twoCompanies(tx: Tx) {
  const make = async (slug: string, plate: string) => {
    const org = await createOrg(tx, slug);
    const owner = await createUser(tx, "Owner");
    const manager = await createUser(tx, "Manager");
    const operator = await createUser(tx, "Operator");
    await addMember(tx, org, owner, "owner");
    await addMember(tx, org, manager, "manager");
    await addMember(tx, org, operator, "operator");
    const vehicle = await addVehicle(tx, org, plate);
    const customer = await addCustomer(tx, org);
    const booking = await addBooking(tx, org, customer, vehicle, "2030-05-01", "2030-05-05");
    return { org, owner, manager, operator, vehicle, customer, booking };
  };
  return { a: await make("company-a", "AA-111-AA"), b: await make("company-b", "BB-222-BB") };
}
