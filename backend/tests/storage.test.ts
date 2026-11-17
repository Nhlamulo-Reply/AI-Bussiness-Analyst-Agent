import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonFileStorage } from "../src/config/storage";
import { DuplicateUserError } from "../src/modules/auth/user.repository";

describe("JsonFileStorage", () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "business-analyst-storage-"));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("creates the JSON store and keeps users across storage instances", async () => {
    const filePath = join(temporaryDirectory, "store.json");
    const storage = new JsonFileStorage({ jsonStoragePath: filePath });
    await storage.connect();

    const user = await storage.insertUser({
      email: "analyst@example.com",
      passwordHash: "bcrypt-hash",
      roles: ["user"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await storage.close();

    const persistedContents = JSON.parse(await readFile(filePath, "utf8")) as {
      version: number;
      users: Array<{ id: string; email: string }>;
      projects: unknown[];
    };
    const reloadedStorage = new JsonFileStorage({ jsonStoragePath: filePath });
    await reloadedStorage.connect();

    expect(persistedContents.version).toBe(2);
    expect(persistedContents.users).toEqual([{ id: user.id, email: user.email, passwordHash: "bcrypt-hash", roles: ["user"], createdAt: user.createdAt, updatedAt: user.updatedAt }]);
    expect(await reloadedStorage.findByEmail(user.email)).toEqual(user);
    await reloadedStorage.close();
  });

  it("serializes writes and rejects duplicate email addresses", async () => {
    const storage = new JsonFileStorage({ jsonStoragePath: join(temporaryDirectory, "store.json") });
    await storage.connect();
    const user = {
      email: "duplicate@example.com",
      passwordHash: "bcrypt-hash",
      roles: ["user" as const],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const results = await Promise.allSettled([
      storage.insertUser(user),
      storage.insertUser(user)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(DuplicateUserError)
    });
    await storage.close();
  });

  it("fails safely when the existing JSON file is malformed", async () => {
    const filePath = join(temporaryDirectory, "store.json");
    await writeFile(filePath, "not-json");
    const storage = new JsonFileStorage({ jsonStoragePath: filePath });

    await expect(storage.connect()).rejects.toThrow("contains invalid JSON");
    expect(await readFile(filePath, "utf8")).toBe("not-json");
  });

  it("checks project ownership and membership from stored JSON", async () => {
    const filePath = join(temporaryDirectory, "store.json");
    await writeFile(filePath, JSON.stringify({
      version: 1,
      users: [],
      projects: [{ id: "project-one", ownerUserId: "owner-one", members: ["member-one"] }]
    }));
    const storage = new JsonFileStorage({ jsonStoragePath: filePath });
    await storage.connect();

    expect(await storage.userCanAccessProject("project-one", "owner-one")).toBe(true);
    expect(await storage.userCanAccessProject("project-one", "member-one")).toBe(true);
    expect(await storage.userCanAccessProject("project-one", "other-user")).toBe(false);
    await storage.close();
  });
});
