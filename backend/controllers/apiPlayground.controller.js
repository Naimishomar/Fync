import axios from "axios";
import ApiPlaygroundLog from "../models/newFeatures/apiPlayground.model.js";
import PlaygroundResource from "../models/newFeatures/playgroundResource.model.js";

const DEFAULT_BASE_URL = "https://jsonplaceholder.typicode.com";

// --- PROXY HANDLER (Still for external) ---
export const executeRequest = async (req, res) => {
    try {
        const { method, endpoint, body, headers } = req.body;
        const { id: userId, username } = req.user;

        if (!method || !endpoint) {
            return res.status(400).json({ success: false, message: "Method and endpoint are required" });
        }

        let fullUrl = endpoint;
        if (endpoint.startsWith("/")) fullUrl = `${DEFAULT_BASE_URL}${endpoint}`;
        else if (!endpoint.startsWith("http")) fullUrl = `${DEFAULT_BASE_URL}/${endpoint}`;

        const finalHeaders = { ...headers, "X-Fync-User": username, "Content-Type": "application/json" };
        const finalBody = body ? { ...body, username } : { username };

        let response;
        try {
            response = await axios({
                method: method.toLowerCase(),
                url: fullUrl,
                headers: finalHeaders,
                data: ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) ? finalBody : undefined
            });
        } catch (axiosError) {
            response = axiosError.response || { status: 500, data: { error: axiosError.message } };
        }

        // Log to history
        await new ApiPlaygroundLog({
            userId, username, method: method.toUpperCase(),
            endpoint: fullUrl, requestBody: finalBody,
            responseStatus: response.status, responseData: response.data
        }).save();

        return res.status(200).json({ success: true, status: response.status, data: response.data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// --- DATASET HANDLERS (JSON-Server Style) ---

const parseOperators = (query) => {
    const mongoQuery = {};
    Object.keys(query).forEach((key) => {
        if (key.startsWith("_")) return;

        // Check for field:operator=value (json-server v1 syntax)
        if (key.includes(":")) {
            const [field, operator] = key.split(":");
            const val = query[key];

            const mongoOpMap = {
                gt: "$gt", gte: "$gte", lt: "$lt", lte: "$lte",
                ne: "$ne", in: "$in", contains: "$regex",
                startsWith: "$regex", endsWith: "$regex"
            };

            const op = mongoOpMap[operator];
            if (op) {
                if (!mongoQuery[`data.${field}`]) mongoQuery[`data.${field}`] = {};

                if (operator === "in") mongoQuery[`data.${field}`][op] = val.split(",");
                else if (operator === "contains") mongoQuery[`data.${field}`][op] = new RegExp(val, "i");
                else if (operator === "startsWith") mongoQuery[`data.${field}`][op] = new RegExp(`^${val}`, "i");
                else if (operator === "endsWith") mongoQuery[`data.${field}`][op] = new RegExp(`${val}$`, "i");
                else mongoQuery[`data.${field}`][op] = isNaN(val) ? val : Number(val);
            }
        } else {
            // Simple field=value
            mongoQuery[`data.${key}`] = query[key];
        }
    });
    return mongoQuery;
};

export const getResources = async (req, res) => {
    try {
        const { resourceName, id } = req.params;
        const { id: userId, username } = req.user;
        const { _sort, _page, _per_page, q } = req.query;

        if (id) {
            const resource = await PlaygroundResource.findOne({ _id: id, userId, resourceName });
            if (!resource) return res.status(404).json({ success: false, message: "Resource Not Found" });
            return res.json(resource);
        }

        let mongoQuery = { userId, resourceName };
        const operators = parseOperators(req.query);
        mongoQuery = { ...mongoQuery, ...operators };

        // q (Full text search)
        if (q) mongoQuery["$or"] = [{ "data.title": { "$regex": q, "$options": "i" } }, { "data.body": { "$regex": q, "$options": "i" } }];

        let find = PlaygroundResource.find(mongoQuery);

        // Sorting
        if (_sort) {
            const isDesc = _sort.startsWith("-");
            const field = isDesc ? `data.${_sort.slice(1)}` : `data.${_sort}`;
            find = find.sort({ [field]: isDesc ? -1 : 1 });
        } else {
            find = find.sort({ createdAt: -1 });
        }

        // Pagination
        const page = parseInt(_page) || 1;
        const perPage = parseInt(_per_page) || 10;
        const count = await PlaygroundResource.countDocuments(mongoQuery);

        const data = await find.skip((page - 1) * perPage).limit(perPage);

        // Log for history
        await new ApiPlaygroundLog({
            userId, username, method: "GET",
            endpoint: `/playground/${resourceName}`,
            responseStatus: 200, responseData: data
        }).save();

        // json-server v1 paging response format
        return res.json({
            first: 1, prev: page > 1 ? page - 1 : null,
            next: page * perPage < count ? page + 1 : null,
            last: Math.ceil(count / perPage),
            pages: Math.ceil(count / perPage),
            items: count,
            data
        });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

export const createResource = async (req, res) => {
    try {
        const { resourceName } = req.params;
        const { id: userId, username } = req.user;

        const resource = new PlaygroundResource({ userId, resourceName, data: req.body });
        await resource.save();

        await new ApiPlaygroundLog({
            userId, username, method: "POST",
            endpoint: `/playground/${resourceName}`, requestBody: req.body,
            responseStatus: 201, responseData: resource
        }).save();

        return res.status(201).json(resource);
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

export const updateResource = async (req, res) => {
    try {
        const { resourceName, id } = req.params;
        const { id: userId, username } = req.user;

        const resource = await PlaygroundResource.findOneAndUpdate(
            { _id: id, userId, resourceName },
            { $set: { data: req.body } },
            { new: true }
        );

        if (!resource) return res.status(404).json({ success: false, message: "Resource Not Found" });

        await new ApiPlaygroundLog({
            userId, username, method: "PUT",
            endpoint: `/playground/${resourceName}/${id}`, requestBody: req.body,
            responseStatus: 200, responseData: resource
        }).save();

        return res.json(resource);
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

export const patchResource = async (req, res) => {
    try {
        const { resourceName, id } = req.params;
        const { id: userId, username } = req.user;

        const resource = await PlaygroundResource.findOne({ _id: id, userId, resourceName });
        if (!resource) return res.status(404).json({ success: false, message: "Resource Not Found" });

        resource.data = { ...resource.data, ...req.body };
        await resource.save();

        await new ApiPlaygroundLog({
            userId, username, method: "PATCH",
            endpoint: `/playground/${resourceName}/${id}`, requestBody: req.body,
            responseStatus: 200, responseData: resource
        }).save();

        return res.json(resource);
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

export const deleteResource = async (req, res) => {
    try {
        const { resourceName, id } = req.params;
        const { id: userId, username } = req.user;

        const resource = await PlaygroundResource.findOneAndDelete({ _id: id, userId, resourceName });
        if (!resource) return res.status(404).json({ success: false, message: "Resource Not Found" });

        await new ApiPlaygroundLog({
            userId, username, method: "DELETE",
            endpoint: `/playground/${resourceName}/${id}`,
            responseStatus: 200, responseData: { message: "Deleted" }
        }).save();

        return res.status(200).json({ message: "Resource deleted" });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};

// --- HISTORY LOGS ---
export const getHistory = async (req, res) => {
    try {
        const history = await ApiPlaygroundLog.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
        return res.status(200).json({ success: true, history });
    } catch (e) { return res.status(500).json({ success: false, message: e.message }); }
};
