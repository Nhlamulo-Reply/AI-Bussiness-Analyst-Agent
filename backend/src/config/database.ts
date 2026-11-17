import { MongoClient, ObjectId, type Db } from "mongodb";
import type { AppConfig } from "./env";
import type { UserRecord, UserRepository } from "../modules/auth/user.repository";
import type { ProjectRepository } from "../common/middleware/project-access";

export interface Database {
  connect(): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export class MongoDatabase implements Database, UserRepository, ProjectRepository {
  private readonly client: MongoClient;
  private database?: Db;

  constructor(private readonly config: Pick<AppConfig, "mongoUri" | "mongoDatabase">) {
    this.client = new MongoClient(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.database = this.client.db(this.config.mongoDatabase);
      await this.database.command({ ping: 1 });
      await this.database.collection<UserRecord>("users").createIndex({ email: 1 }, { unique: true });
    } catch (error) {
      await this.client.close();
      this.database = undefined;
      throw error;
    }
  }

  async ping(): Promise<void> {
    if (!this.database) {
      throw new Error("MongoDB has not connected");
    }
    await this.database.command({ ping: 1 });
  }

  async close(): Promise<void> {
    await this.client.close();
    this.database = undefined;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.getDatabase().collection<UserRecord>("users").findOne({ email });
  }

  async insertUser(user: Omit<UserRecord, "_id">): Promise<UserRecord> {
    const collection = this.getDatabase().collection<UserRecord>("users");
    const record = { ...user, _id: new ObjectId() };
    await collection.insertOne(record);
    return record;
  }

  async userCanAccessProject(projectId: string, userId: string): Promise<boolean> {
    const projectObjectId = new ObjectId(projectId);
    const userObjectId = new ObjectId(userId);
    const project = await this.getDatabase().collection("projects").findOne(
      {
        _id: projectObjectId,
        $or: [{ ownerUserId: userObjectId }, { members: userObjectId }]
      },
      { projection: { _id: 1 } }
    );
    return project !== null;
  }

  private getDatabase(): Db {
    if (!this.database) {
      throw new Error("MongoDB is not connected");
    }
    return this.database;
  }
}
