"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectToDatabase = connectToDatabase;
exports.toPlainDoc = toPlainDoc;
const mongoose_1 = __importDefault(require("mongoose"));
__exportStar(require("./models"), exports);
__exportStar(require("./cloneConfig"), exports);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/clone_db";
let isConnected = false;
mongoose_1.default.set("toJSON", {
    virtuals: true,
    transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});
function isObjectId(val) {
    if (!val)
        return false;
    if (typeof val === "string")
        return mongoose_1.default.Types.ObjectId.isValid(val) && (val.length === 24 || val.length === 12);
    if (val instanceof mongoose_1.default.Types.ObjectId)
        return true;
    if (val.constructor?.name === "ObjectId")
        return true;
    if (typeof val === "object" && val.buffer) {
        const b = val.buffer;
        try {
            const len = b.length || Object.keys(b).length;
            return len === 12;
        }
        catch {
            return false;
        }
    }
    return mongoose_1.default.Types.ObjectId.isValid(val);
}
function toId(val) {
    if (!val)
        return val;
    if (typeof val === "string") {
        if (mongoose_1.default.Types.ObjectId.isValid(val))
            return new mongoose_1.default.Types.ObjectId(val);
        return val;
    }
    if (val instanceof mongoose_1.default.Types.ObjectId || val.constructor?.name === "ObjectId")
        return val;
    if (typeof val === "object" && val.buffer) {
        const b = val.buffer;
        try {
            const buf = Buffer.isBuffer(b) ? b : Buffer.from(Object.values(b).map((x) => Number(x)));
            return new mongoose_1.default.Types.ObjectId(buf);
        }
        catch {
            return val;
        }
    }
    try {
        return new mongoose_1.default.Types.ObjectId(val);
    }
    catch {
        return val;
    }
}
function isIdLikeKey(k) {
    if (k === "id" || k === "_id")
        return true;
    if (k.endsWith("Id"))
        return true;
    return false;
}
function isPlainObject(val) {
    if (!val || typeof val !== "object")
        return false;
    if (Array.isArray(val))
        return false;
    if (val instanceof Date)
        return false;
    if (val instanceof mongoose_1.default.Types.ObjectId)
        return false;
    if (Buffer.isBuffer(val))
        return false;
    const ctor = val.constructor?.name;
    if (ctor && ctor !== "Object")
        return false;
    return true;
}
function ensureIds(obj) {
    if (!obj || typeof obj !== "object")
        return obj;
    if (obj instanceof Date || obj instanceof mongoose_1.default.Types.ObjectId || Buffer.isBuffer(obj))
        return obj;
    if (Array.isArray(obj))
        return obj.map(ensureIds);
    if (!isPlainObject(obj))
        return obj;
    const out = { ...obj };
    for (const [k, v] of Object.entries(out)) {
        if (isIdLikeKey(k) && v !== undefined && v !== null) {
            out[k] = toId(v);
        }
        else if (Array.isArray(v) || isPlainObject(v)) {
            out[k] = ensureIds(v);
        }
    }
    return out;
}
async function connectToDatabase() {
    if (isConnected) {
        return mongoose_1.default;
    }
    const db = await mongoose_1.default.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
    });
    isConnected = db.connections[0].readyState === 1;
    console.log("🍃 MongoDB connected successfully via Mongoose to:", MONGODB_URI.replace(/\/\/.*@/, "//***@"));
    return db;
}
function toPlainDoc(doc) {
    if (!doc)
        return null;
    if (Array.isArray(doc))
        return doc.map(toPlainDoc);
    const obj = doc.toJSON ? doc.toJSON() : doc;
    obj.id = obj.id || obj._id?.toString();
    return obj;
}
function applySort(query, orderBy, defaultSort = { createdAt: -1 }) {
    if (orderBy) {
        const sortObj = {};
        for (const [k, v] of Object.entries(orderBy))
            sortObj[k] = v === "desc" || v === -1 ? -1 : 1;
        return query.sort(sortObj);
    }
    return query.sort(defaultSort);
}
const FIELD_ALIASES = {
    assignedEmployeeId: "assignedEmployee",
    leadEmployeeId: "leadEmployee",
    employeeId: "employee",
    taskId: "task",
    teamId: "team",
    projectId: "project",
    conversationId: "conversation",
    channelId: "channel",
    senderId: "sender",
    parentMessageId: "parentMessage",
    userId: "user",
    companyId: "company",
    approvedByUserId: "approvedByUser",
    memberIds: "members",
};
function normalizeDoc(doc) {
    if (!doc)
        return doc;
    if (Array.isArray(doc))
        return doc.map(normalizeDoc);
    if (doc instanceof mongoose_1.default.Types.ObjectId)
        return doc.toString();
    if (typeof doc === "object" && doc.constructor?.name === "ObjectId")
        return doc.toString();
    const obj = doc?.toObject ? doc.toObject({ virtuals: true, flattenObjectIds: false }) : { ...doc };
    for (const [from, to] of Object.entries(FIELD_ALIASES)) {
        if (obj[from] !== undefined && obj[to] === undefined) {
            obj[to] = normalizeDoc(obj[from]);
        }
    }
    for (const k of Object.keys(obj)) {
        if (!obj[k])
            continue;
        if (obj[k] instanceof mongoose_1.default.Types.ObjectId || obj[k]?.constructor?.name === "ObjectId") {
            obj[k] = obj[k].toString();
        }
        else if (typeof obj[k] === "object" && !Array.isArray(obj[k])) {
            if (obj[k].buffer && typeof obj[k].buffer === "object" && (obj[k].buffer instanceof Uint8Array || Buffer.isBuffer(obj[k].buffer) || (typeof obj[k].buffer === "object" && Object.keys(obj[k].buffer).length === 12))) {
                try {
                    obj[k] = new mongoose_1.default.Types.ObjectId(Buffer.from(obj[k].buffer)).toString();
                }
                catch { /* ignore */ }
            }
            else {
                obj[k] = normalizeDoc(obj[k]);
            }
        }
        else if (Array.isArray(obj[k])) {
            obj[k] = obj[k].map(normalizeDoc);
        }
    }
    if (obj.id === undefined && obj._id) {
        if (obj._id instanceof mongoose_1.default.Types.ObjectId || obj._id?.constructor?.name === "ObjectId")
            obj.id = obj._id.toString();
        else if (typeof obj._id === "string")
            obj.id = obj._id;
        else if (obj._id && obj._id.buffer) {
            try {
                obj.id = new mongoose_1.default.Types.ObjectId(Buffer.from(obj._id.buffer)).toString();
            }
            catch {
                obj.id = String(obj._id);
            }
        }
        else
            obj.id = String(obj._id);
    }
    if (obj._id && typeof obj._id === "object")
        delete obj._id;
    return obj;
}
async function N(p) {
    const r = await p;
    return normalizeDoc(r);
}
exports.prisma = {
    $connect: connectToDatabase,
    $disconnect: async () => mongoose_1.default.disconnect(),
    user: {
        findUnique: async (a) => {
            const { UserModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (a.where?.email)
                return N(UserModel.findOne({ email: a.where.email }));
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                return N(UserModel.findById(a.where.id));
            }
            return null;
        },
        upsert: async (a) => {
            const { UserModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            let d = await UserModel.findOne(a.where);
            if (!d)
                d = await UserModel.create(a.create);
            return N(d);
        },
        create: async (a) => N((await Promise.resolve().then(() => __importStar(require("./models")))).UserModel.create(a.data)),
        update: async (a) => {
            const { UserModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(UserModel.findByIdAndUpdate(a.where.id, a.data, { new: true }));
        },
    },
    company: {
        findUnique: async (a) => {
            const { CompanyModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (a.where?.slug)
                return N(CompanyModel.findOne({ slug: a.where.slug }));
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                return N(CompanyModel.findById(a.where.id));
            }
            return null;
        },
        findMany: async (a) => N((await Promise.resolve().then(() => __importStar(require("./models")))).CompanyModel.find(a?.where || {})),
        upsert: async (a) => {
            const { CompanyModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            let d = await CompanyModel.findOne(a.where);
            if (!d)
                d = await CompanyModel.create(a.create);
            return N(d);
        },
        create: async (a) => N((await Promise.resolve().then(() => __importStar(require("./models")))).CompanyModel.create(a.data)),
        update: async (a) => {
            const { CompanyModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(CompanyModel.findByIdAndUpdate(a.where.id, a.data, { new: true }));
        },
    },
    membership: {
        findUnique: async (a) => {
            const { MembershipModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const raw = a.where?.userId_companyId || a.where;
            if (raw.userId && !isObjectId(raw.userId))
                return null;
            if (raw.companyId && !isObjectId(raw.companyId))
                return null;
            const w = {};
            if (raw.userId)
                w.userId = toId(raw.userId);
            if (raw.companyId)
                w.companyId = toId(raw.companyId);
            return N(MembershipModel.findOne(w).populate("companyId").populate("userId"));
        },
        findMany: async (a) => {
            const { MembershipModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.userId) {
                if (!isObjectId(a.where.userId))
                    return [];
                w.userId = toId(a.where.userId);
            }
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            return N(MembershipModel.find(w).populate("companyId").populate("userId"));
        },
        upsert: async (a) => {
            const { MembershipModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const raw = a.where?.userId_companyId || a.where;
            if (raw.userId && !isObjectId(raw.userId))
                return null;
            if (raw.companyId && !isObjectId(raw.companyId))
                return null;
            const w = {};
            if (raw.userId)
                w.userId = toId(raw.userId);
            if (raw.companyId)
                w.companyId = toId(raw.companyId);
            let d = await MembershipModel.findOne(w);
            if (!d)
                d = await MembershipModel.create(ensureIds(a.create));
            return N(d);
        },
        create: async (a) => {
            const { MembershipModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(MembershipModel.create(data));
        },
    },
    team: {
        create: async (a) => {
            const { TeamModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(TeamModel.create(data));
        },
        findMany: async (a) => {
            const { TeamModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            let q = TeamModel.find(w);
            if (a?.include?.members)
                q = q.populate("memberIds");
            if (a?.include?.leadEmployee)
                q = q.populate("leadEmployeeId");
            q = applySort(q, a?.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findUnique: async (a) => {
            const { TeamModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                let q = TeamModel.findById(toId(a.where.id));
                if (a?.include?.members)
                    q = q.populate("memberIds");
                if (a?.include?.leadEmployee)
                    q = q.populate("leadEmployeeId");
                return N(q);
            }
            return null;
        },
    },
    connectedAccount: {
        create: async (a) => {
            const { ConnectedAccountModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(ConnectedAccountModel.create(data));
        },
        findMany: async (a) => {
            const { ConnectedAccountModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.status)
                w.status = a.where.status;
            if (a?.where?.provider)
                w.provider = a.where.provider;
            let q = ConnectedAccountModel.find(w);
            if (a?.orderBy)
                q = applySort(q, a.orderBy, { connectedAt: -1 });
            else
                q = q.sort({ connectedAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findFirst: async (a) => {
            const { ConnectedAccountModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const q = {};
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                q._id = toId(a.where.id);
            }
            if (a.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return null;
                q.companyId = toId(a.where.companyId);
            }
            if (a.where?.provider)
                q.provider = a.where.provider;
            return N(ConnectedAccountModel.findOne(q));
        },
        update: async (a) => {
            const { ConnectedAccountModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            const data = ensureIds(a.data);
            return N(ConnectedAccountModel.findByIdAndUpdate(toId(a.where.id), data, { new: true }));
        },
    },
    aIEmployee: {
        create: async (a) => {
            const { AIEmployeeModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(AIEmployeeModel.create(data));
        },
        findMany: async (a) => {
            const { AIEmployeeModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.status)
                w.status = a.where.status;
            let q = AIEmployeeModel.find(w);
            if (a?.include?.team || a?.include?.teamId) {
                q = q.populate({
                    path: "teamId",
                    select: a.include.team?.select ? Object.keys(a.include.team.select).join(" ") : undefined,
                });
            }
            else {
                q = q.populate("teamId");
            }
            if (a?.include?.permissions)
                q = q.populate("permissions");
            q = applySort(q, a?.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findUnique: async (a) => {
            const { AIEmployeeModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                let q = AIEmployeeModel.findById(toId(a.where.id));
                if (a?.include?.team)
                    q = q.populate("teamId");
                if (a?.include?.permissions)
                    q = q.populate("permissions");
                if (a?.include?.instructions)
                    q = q.populate("instructions");
                if (a?.include?.tasksAssigned)
                    q = q.populate({ path: "tasksAssigned", options: { limit: a.include.tasksAssigned.take || 10, sort: { createdAt: -1 } } });
                return N(q);
            }
            return null;
        },
        findFirst: async (a) => {
            const { AIEmployeeModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const q = {};
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                q._id = toId(a.where.id);
            }
            if (a.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return null;
                q.companyId = toId(a.where.companyId);
            }
            let qry = AIEmployeeModel.findOne(q);
            if (a?.include?.team)
                qry = qry.populate("teamId");
            if (a?.include?.permissions)
                qry = qry.populate("permissions");
            if (a?.include?.instructions)
                qry = qry.populate("instructions");
            if (a?.include?.tasksAssigned)
                qry = qry.populate({ path: "tasksAssigned", options: { limit: a.include.tasksAssigned.take || 10, sort: { createdAt: -1 } } });
            return N(qry);
        },
        update: async (a) => {
            const { AIEmployeeModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            const data = ensureIds(a.data);
            return N(AIEmployeeModel.findByIdAndUpdate(toId(a.where?.id), data, { new: true }));
        },
        updateMany: async (a) => {
            const { AIEmployeeModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const q = {};
            if (a.where?.id)
                q._id = toId(a.where.id);
            if (a.where?.companyId)
                q.companyId = toId(a.where.companyId);
            return AIEmployeeModel.updateMany(q, ensureIds(a.data));
        },
        delete: async (a) => {
            const { AIEmployeeModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(AIEmployeeModel.findByIdAndDelete(toId(a.where?.id)));
        },
    },
    task: {
        create: async (a) => {
            const { TaskModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(TaskModel.create(data));
        },
        findMany: async (a) => {
            const { TaskModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.status)
                w.status = a.where.status;
            if (a?.where?.priority)
                w.priority = a.where.priority;
            if (a?.where?.assignedEmployeeId)
                w.assignedEmployeeId = toId(a.where.assignedEmployeeId);
            let q = TaskModel.find(w);
            if (a?.include?.assignedEmployee) {
                q = q.populate({
                    path: "assignedEmployeeId",
                    select: a.include.assignedEmployee?.select ? Object.keys(a.include.assignedEmployee.select).join(" ") : undefined,
                });
            }
            if (a?.include?.project) {
                q = q.populate({
                    path: "projectId",
                    select: a.include.project?.select ? Object.keys(a.include.project.select).join(" ") : undefined,
                });
            }
            if (a?.include?.executions) {
                q = q.populate({ path: "executions", options: { limit: a.include.executions.take || 5, sort: { startedAt: -1 } } });
            }
            if (a?.include?.approvals) {
                q = q.populate({ path: "approvals", options: { limit: a.include.approvals.take || 3, sort: { createdAt: -1 } } });
            }
            q = applySort(q, a?.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findUnique: async (a) => {
            const { TaskModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                let q = TaskModel.findById(toId(a.where.id));
                if (a?.include?.assignedEmployee)
                    q = q.populate("assignedEmployeeId");
                if (a?.include?.executions)
                    q = q.populate({ path: "executions", options: { limit: 5, sort: { startedAt: -1 } } });
                if (a?.include?.approvals)
                    q = q.populate({ path: "approvals", options: { limit: 3, sort: { createdAt: -1 } } });
                return N(q);
            }
            return null;
        },
        findFirst: async (a) => {
            const { TaskModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const q = {};
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                q._id = toId(a.where.id);
            }
            if (a.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return null;
                q.companyId = toId(a.where.companyId);
            }
            let qry = TaskModel.findOne(q);
            if (a?.include?.assignedEmployee)
                qry = qry.populate("assignedEmployeeId");
            if (a?.include?.executions)
                qry = qry.populate({ path: "executions", options: { limit: 5, sort: { startedAt: -1 } } });
            if (a?.include?.approvals)
                qry = qry.populate({ path: "approvals", options: { limit: 3, sort: { createdAt: -1 } } });
            return N(qry);
        },
        update: async (a) => {
            const { TaskModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            const data = ensureIds(a.data);
            return N(TaskModel.findByIdAndUpdate(toId(a.where?.id), data, { new: true }));
        },
    },
    approvalRequest: {
        create: async (a) => N((await Promise.resolve().then(() => __importStar(require("./models")))).ApprovalRequestModel.create(a.data)),
        findFirst: async (a) => {
            const { ApprovalRequestModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const q = {};
            if (a?.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                q._id = a.where.id;
            }
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return null;
                q.companyId = a.where.companyId;
            }
            if (a?.where?.status)
                q.status = a.where.status;
            let qry = ApprovalRequestModel.findOne(q);
            if (a?.include?.employee)
                qry = qry.populate({ path: "employeeId", select: a.include.employee?.select ? Object.keys(a.include.employee.select).join(" ") : undefined });
            if (a?.include?.task)
                qry = qry.populate({ path: "taskId", select: a.include.task?.select ? Object.keys(a.include.task.select).join(" ") : undefined });
            return N(qry);
        },
        findUnique: async (a) => {
            const { ApprovalRequestModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                let q = ApprovalRequestModel.findById(a.where.id);
                if (a?.include?.employee)
                    q = q.populate("employeeId");
                if (a?.include?.task)
                    q = q.populate("taskId");
                return N(q);
            }
            return null;
        },
        findMany: async (a) => {
            const { ApprovalRequestModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = a.where.companyId;
            }
            if (a?.where?.status)
                w.status = a.where.status;
            let q = ApprovalRequestModel.find(w);
            if (a?.include?.employee) {
                q = q.populate({
                    path: "employeeId",
                    select: a.include.employee?.select ? Object.keys(a.include.employee.select).join(" ") : undefined,
                });
            }
            if (a?.include?.task) {
                q = q.populate({
                    path: "taskId",
                    select: a.include.task?.select ? Object.keys(a.include.task.select).join(" ") : undefined,
                });
            }
            q = applySort(q, a?.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        update: async (a) => {
            const { ApprovalRequestModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(ApprovalRequestModel.findByIdAndUpdate(a.where?.id, a.data, { new: true }));
        },
    },
    employeeMemory: {
        create: async (a) => N((await Promise.resolve().then(() => __importStar(require("./models")))).EmployeeMemoryModel.create(a.data)),
        findMany: async (a) => {
            const { EmployeeMemoryModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = a.where.companyId;
            }
            if (a?.where?.employeeId)
                w.employeeId = a.where.employeeId;
            if (a?.where?.scope)
                w.scope = a.where.scope;
            let q = EmployeeMemoryModel.find(w);
            if (a?.orderBy)
                q = applySort(q, a.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
    },
    activityLog: {
        create: async (a) => N((await Promise.resolve().then(() => __importStar(require("./models")))).ActivityLogModel.create(a.data)),
        findMany: async (a) => {
            const { ActivityLogModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = a.where.companyId;
            }
            if (a?.where?.employeeId)
                w.employeeId = a.where.employeeId;
            if (a?.where?.action)
                w.action = a.where.action;
            let q = ActivityLogModel.find(w);
            if (a?.include?.employee) {
                q = q.populate({
                    path: "employeeId",
                    select: a.include.employee?.select ? Object.keys(a.include.employee.select).join(" ") : undefined,
                });
            }
            if (a?.orderBy) {
                const so = {};
                for (const [k, v] of Object.entries(a.orderBy))
                    so[k] = v === "desc" || v === -1 ? -1 : 1;
                q = q.sort(so);
            }
            else {
                q = q.sort({ timestamp: -1, createdAt: -1 });
            }
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
    },
    loginHistory: {
        create: async (_a) => null,
        findMany: async (_a) => [],
    },
    oAuthState: {
        create: async (a) => {
            const { OAuthStateModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(OAuthStateModel.create(data));
        },
        findUnique: async (a) => {
            const { OAuthStateModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (a.where?.stateToken)
                return N(OAuthStateModel.findOne({ stateToken: a.where.stateToken }));
            if (a.where?.id) {
                if (!isObjectId(a.where.id))
                    return null;
                return N(OAuthStateModel.findById(toId(a.where.id)));
            }
            return null;
        },
        delete: async (a) => {
            const { OAuthStateModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (a.where?.stateToken)
                return N(OAuthStateModel.findOneAndDelete({ stateToken: a.where.stateToken }));
            if (a.where?.id && isObjectId(a.where.id))
                return N(OAuthStateModel.findByIdAndDelete(toId(a.where.id)));
            return null;
        },
    },
    auditLog: {
        create: async (a) => {
            const { AuditLogModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(AuditLogModel.create(data));
        },
        findMany: async (a) => {
            const { AuditLogModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.action)
                w.action = a.where.action;
            if (a?.where?.userId)
                w.userId = toId(a.where.userId);
            let q = AuditLogModel.find(w);
            if (a?.orderBy) {
                const so = {};
                for (const [k, v] of Object.entries(a.orderBy))
                    so[k] = v === "desc" || v === -1 ? -1 : 1;
                q = q.sort(so);
            }
            else {
                q = q.sort({ timestamp: -1, createdAt: -1 });
            }
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
    },
    conversation: {
        create: async (a) => N((await Promise.resolve().then(() => __importStar(require("./models")))).ConversationModel.create(a.data)),
        findMany: async (a) => {
            const { ConversationModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = a.where.companyId;
            if (a?.where?.employeeId && isObjectId(a.where.employeeId))
                w.employeeId = a.where.employeeId;
            let q = ConversationModel.find(w).sort({ updatedAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findFirst: async (a) => {
            const { ConversationModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.id && isObjectId(a.where.id))
                w._id = a.where.id;
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = a.where.companyId;
            if (a?.where?.employeeId && isObjectId(a.where.employeeId))
                w.employeeId = a.where.employeeId;
            return N(ConversationModel.findOne(w).sort({ updatedAt: -1 }));
        },
        update: async (a) => {
            const { ConversationModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(ConversationModel.findByIdAndUpdate(a.where.id, a.data, { new: true }));
        },
        delete: async (a) => {
            const { ConversationModel, ConversationMessageModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            await ConversationMessageModel.deleteMany({ conversationId: a.where.id });
            return N(ConversationModel.findByIdAndDelete(a.where.id));
        },
    },
    conversationMessage: {
        create: async (a) => N((await Promise.resolve().then(() => __importStar(require("./models")))).ConversationMessageModel.create(a.data)),
        findMany: async (a) => {
            const { ConversationMessageModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.conversationId && isObjectId(a.where.conversationId))
                w.conversationId = a.where.conversationId;
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = a.where.companyId;
            let q = ConversationMessageModel.find(w).sort({ createdAt: 1 }).populate("senderId").populate("mentions").populate("taskId");
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        update: async (a) => {
            const { ConversationMessageModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(ConversationMessageModel.findByIdAndUpdate(a.where.id, a.data, { new: true }));
        },
    },
    // ─── Runtime Engine Adapters ─────────────────────────────────────────────
    runtimeEvent: {
        create: async (a) => {
            const { RuntimeEventModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(RuntimeEventModel.create(data));
        },
        findMany: async (a) => {
            const { RuntimeEventModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.source)
                w.source = a.where.source;
            if (a?.where?.eventType)
                w.eventType = a.where.eventType;
            if (a?.where?.processedAt === null)
                w.processedAt = null;
            let q = RuntimeEventModel.find(w);
            q = applySort(q, a?.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findFirst: async (a) => {
            const { RuntimeEventModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.id && isObjectId(a.where.id))
                w._id = toId(a.where.id);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.deduplicationKey)
                w.deduplicationKey = a.where.deduplicationKey;
            return N(RuntimeEventModel.findOne(w));
        },
        update: async (a) => {
            const { RuntimeEventModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(RuntimeEventModel.findByIdAndUpdate(toId(a.where.id), a.data, { new: true }));
        },
        count: async (a) => {
            const { RuntimeEventModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.processedAt === null)
                w.processedAt = null;
            return RuntimeEventModel.countDocuments(w);
        },
    },
    runtimeTrigger: {
        create: async (a) => {
            const { RuntimeTriggerModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const data = ensureIds(a.data);
            return N(RuntimeTriggerModel.create(data));
        },
        createMany: async (a) => {
            const { RuntimeTriggerModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const docs = (a.data || []).map(ensureIds);
            return RuntimeTriggerModel.insertMany(docs, { ordered: false });
        },
        findMany: async (a) => {
            const { RuntimeTriggerModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.cloneId) {
                if (!isObjectId(a.where.cloneId))
                    return [];
                w.cloneId = toId(a.where.cloneId);
            }
            if (a?.where?.enabled !== undefined)
                w.enabled = a.where.enabled;
            if (a?.where?.triggerType)
                w.triggerType = a.where.triggerType;
            let q = RuntimeTriggerModel.find(w);
            q = applySort(q, a?.orderBy, { priority: 1, createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findFirst: async (a) => {
            const { RuntimeTriggerModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.id && isObjectId(a.where.id))
                w._id = toId(a.where.id);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            if (a?.where?.source)
                w.source = a.where.source;
            if (a?.where?.eventType)
                w.eventType = a.where.eventType;
            return N(RuntimeTriggerModel.findOne(w));
        },
        deleteMany: async (a) => {
            const { RuntimeTriggerModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            return RuntimeTriggerModel.deleteMany(w);
        },
    },
    runtimeAction: {
        create: async (a) => {
            const { RuntimeActionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            return N(RuntimeActionModel.create(ensureIds(a.data)));
        },
        createMany: async (a) => {
            const { RuntimeActionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const docs = (a.data || []).map(ensureIds);
            return RuntimeActionModel.insertMany(docs, { ordered: false });
        },
        findMany: async (a) => {
            const { RuntimeActionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.cloneId) {
                if (!isObjectId(a.where.cloneId))
                    return [];
                w.cloneId = toId(a.where.cloneId);
            }
            if (a?.where?.enabled !== undefined)
                w.enabled = a.where.enabled;
            let q = RuntimeActionModel.find(w);
            q = applySort(q, a?.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        deleteMany: async (a) => {
            const { RuntimeActionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            return RuntimeActionModel.deleteMany(w);
        },
    },
    runtimeExecution: {
        create: async (a) => {
            const { RuntimeExecutionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            return N(RuntimeExecutionModel.create(ensureIds(a.data)));
        },
        findMany: async (a) => {
            const { RuntimeExecutionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.cloneId) {
                if (!isObjectId(a.where.cloneId))
                    return [];
                w.cloneId = toId(a.where.cloneId);
            }
            if (a?.where?.status)
                w.status = a.where.status;
            let q = RuntimeExecutionModel.find(w);
            if (a?.include?.clone)
                q = q.populate({ path: "cloneId", select: "name role avatarUrl status" });
            q = applySort(q, a?.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findFirst: async (a) => {
            const { RuntimeExecutionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.id && isObjectId(a.where.id))
                w._id = toId(a.where.id);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            if (a?.where?.status)
                w.status = a.where.status;
            let qry = RuntimeExecutionModel.findOne(w);
            if (a?.include?.clone)
                qry = qry.populate({ path: "cloneId", select: "name role avatarUrl status" });
            return N(qry);
        },
        update: async (a) => {
            const { RuntimeExecutionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(RuntimeExecutionModel.findByIdAndUpdate(toId(a.where.id), a.data, { new: true }));
        },
        count: async (a) => {
            const { RuntimeExecutionModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.status)
                w.status = a.where.status;
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            return RuntimeExecutionModel.countDocuments(w);
        },
    },
    runtimeSchedule: {
        create: async (a) => {
            const { RuntimeScheduleModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            return N(RuntimeScheduleModel.create(ensureIds(a.data)));
        },
        createMany: async (a) => {
            const { RuntimeScheduleModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const docs = (a.data || []).map(ensureIds);
            return RuntimeScheduleModel.insertMany(docs, { ordered: false });
        },
        findMany: async (a) => {
            const { RuntimeScheduleModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.cloneId) {
                if (!isObjectId(a.where.cloneId))
                    return [];
                w.cloneId = toId(a.where.cloneId);
            }
            if (a?.where?.enabled !== undefined)
                w.enabled = a.where.enabled;
            if (a?.where?.nextRunAt) {
                // support { lte: Date } for scheduler polling
                if (a.where.nextRunAt.lte)
                    w.nextRunAt = { $lte: a.where.nextRunAt.lte };
                else
                    w.nextRunAt = a.where.nextRunAt;
            }
            let q = RuntimeScheduleModel.find(w);
            q = applySort(q, a?.orderBy, { nextRunAt: 1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findFirst: async (a) => {
            const { RuntimeScheduleModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.id && isObjectId(a.where.id))
                w._id = toId(a.where.id);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            return N(RuntimeScheduleModel.findOne(w));
        },
        update: async (a) => {
            const { RuntimeScheduleModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(RuntimeScheduleModel.findByIdAndUpdate(toId(a.where.id), a.data, { new: true }));
        },
        deleteMany: async (a) => {
            const { RuntimeScheduleModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            return RuntimeScheduleModel.deleteMany(w);
        },
    },
    runtimeCommitment: {
        create: async (a) => {
            const { RuntimeCommitmentModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            return N(RuntimeCommitmentModel.create(ensureIds(a.data)));
        },
        findMany: async (a) => {
            const { RuntimeCommitmentModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.cloneId) {
                if (!isObjectId(a.where.cloneId))
                    return [];
                w.cloneId = toId(a.where.cloneId);
            }
            if (a?.where?.status) {
                if (Array.isArray(a.where.status))
                    w.status = { $in: a.where.status };
                else
                    w.status = a.where.status;
            }
            if (a?.where?.dueAt) {
                if (a.where.dueAt.lte)
                    w.dueAt = { $lte: a.where.dueAt.lte };
                else
                    w.dueAt = a.where.dueAt;
            }
            let q = RuntimeCommitmentModel.find(w);
            if (a?.include?.clone)
                q = q.populate({ path: "cloneId", select: "name role avatarUrl" });
            q = applySort(q, a?.orderBy, { dueAt: 1, createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findFirst: async (a) => {
            const { RuntimeCommitmentModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.id && isObjectId(a.where.id))
                w._id = toId(a.where.id);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            return N(RuntimeCommitmentModel.findOne(w));
        },
        update: async (a) => {
            const { RuntimeCommitmentModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(RuntimeCommitmentModel.findByIdAndUpdate(toId(a.where.id), a.data, { new: true }));
        },
        updateMany: async (a) => {
            const { RuntimeCommitmentModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            if (a?.where?.status)
                w.status = a.where.status;
            return RuntimeCommitmentModel.updateMany(w, a.data);
        },
        count: async (a) => {
            const { RuntimeCommitmentModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            if (a?.where?.status) {
                if (Array.isArray(a.where.status))
                    w.status = { $in: a.where.status };
                else
                    w.status = a.where.status;
            }
            return RuntimeCommitmentModel.countDocuments(w);
        },
    },
    runtimeEscalation: {
        create: async (a) => {
            const { RuntimeEscalationModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            return N(RuntimeEscalationModel.create(ensureIds(a.data)));
        },
        findMany: async (a) => {
            const { RuntimeEscalationModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId) {
                if (!isObjectId(a.where.companyId))
                    return [];
                w.companyId = toId(a.where.companyId);
            }
            if (a?.where?.cloneId) {
                if (!isObjectId(a.where.cloneId))
                    return [];
                w.cloneId = toId(a.where.cloneId);
            }
            if (a?.where?.status)
                w.status = a.where.status;
            if (a?.where?.severity)
                w.severity = a.where.severity;
            let q = RuntimeEscalationModel.find(w);
            if (a?.include?.clone)
                q = q.populate({ path: "cloneId", select: "name role avatarUrl" });
            q = applySort(q, a?.orderBy, { createdAt: -1 });
            if (a?.take)
                q = q.limit(a.take);
            return N(q);
        },
        findFirst: async (a) => {
            const { RuntimeEscalationModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.id && isObjectId(a.where.id))
                w._id = toId(a.where.id);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            return N(RuntimeEscalationModel.findOne(w));
        },
        update: async (a) => {
            const { RuntimeEscalationModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            if (!isObjectId(a.where?.id))
                return null;
            return N(RuntimeEscalationModel.findByIdAndUpdate(toId(a.where.id), a.data, { new: true }));
        },
        count: async (a) => {
            const { RuntimeEscalationModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            if (a?.where?.status)
                w.status = a.where.status;
            return RuntimeEscalationModel.countDocuments(w);
        },
    },
    compiledRuntimeState: {
        upsert: async (a) => {
            const { CompiledRuntimeStateModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const filter = {};
            if (a.where?.cloneId && isObjectId(a.where.cloneId))
                filter.cloneId = toId(a.where.cloneId);
            return N(CompiledRuntimeStateModel.findOneAndUpdate(filter, ensureIds({ ...a.update, ...a.create }), { upsert: true, new: true }));
        },
        findFirst: async (a) => {
            const { CompiledRuntimeStateModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.cloneId && isObjectId(a.where.cloneId))
                w.cloneId = toId(a.where.cloneId);
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            return N(CompiledRuntimeStateModel.findOne(w));
        },
        findMany: async (a) => {
            const { CompiledRuntimeStateModel } = await Promise.resolve().then(() => __importStar(require("./models")));
            const w = {};
            if (a?.where?.companyId && isObjectId(a.where.companyId))
                w.companyId = toId(a.where.companyId);
            return N(CompiledRuntimeStateModel.find(w));
        },
    },
};
//# sourceMappingURL=index.js.map