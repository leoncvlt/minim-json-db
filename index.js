const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const getAppName = () => {
  try {
    const app = require(path.join(process.cwd(), "package.json"));
    return app.name;
  } catch (error) {
    console.warn("Unable to infer application name from package.json");
  }

  try {
    const { app } = require("electron");
    return app.getName();
  } catch (error) {
    console.warn("Unable to infer application name from electron's 'app' module");
  }

  return undefined;
};

const getDatabasePath = (fallbackName) => {
  let appName = getAppName();
  if (!appName) {
    console.warn(
      `Could not infer app name from package.json or electron's app. Using the collection name` +
        `${fallbackName} as fallback value to create database filepath.`
    );
    appName = fallbackName;
  }
  const platform = os.platform();
  if (platform === "win32") {
    return path.join(process.env.APPDATA, appName);
  } else if (platform === "darwin") {
    return path.join(process.env.HOME, "Library", "Application Support", appName);
  } else {
    return path.join("var", "local", appName);
  }
};

module.exports = {
  collection: function (name, filepath = null) {
    filepath = filepath || path.join(getDatabasePath(name), name + ".json");
    return new Collection(name, filepath);
  },
};

class Collection {
  constructor(name, filepath) {
    this.name = name;
    this._data = { [this.name]: [] };
    if (fs.existsSync(filepath)) {
      console.log(`Found existing database table at ${filepath}`);
      this.filepath = filepath;
      this.sync();
    } else {
      try {
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(this.data, null, 2));
        console.log(`Created database table at ${filepath}`);
        this.filepath = filepath;
      } catch (error) {
        throw new Error(`Could not create database table at ${filepath}: ${error}`);
      }
    }
  }

  get data() {
    return this._data;
  }

  set data(newData) {
    this._data = newData;
    fs.writeFileSync(this.filepath, JSON.stringify(this._data, null, 2));
  }

  sync() {
    if (this.filepath && fs.existsSync(this.filepath)) {
      this.data = JSON.parse(fs.readFileSync(this.filepath));
    } else {
      throw new Error(`No database file found at ${this.filepath} for collection ${this.name}.`);
    }
  }

  insert(document) {
    return new Promise((resolve, reject) => {
      let newData = this.data;

      let insertedDocuments = [];
      const _insert = (document) => {
        if (!document || typeof document !== "object") {
          reject(`Trying to insert invalid document: ${document}`);
          return;
        }
        if (!("id" in document)) {
          let id = crypto.randomBytes(16).toString("hex");
          document["id"] = id;
        }
        newData[this.name].push(document);
        insertedDocuments.push(document);
      };

      if (Array.isArray(document)) {
        document.forEach((d) => _insert(d));
      } else {
        _insert(document);
      }

      this.data = newData;
      resolve(insertedDocuments);
    });
  }

  find(query = {}) {
    return new Promise((resolve, reject) => {
      const data = this.data;

      let results = [];
      if (typeof query === "object") {
        if (Object.keys(query).length === 0) {
          results = data[this.name];
        } else {
          results = data[this.name].filter((document) =>
            Object.keys(query).every((key) => document[key] === query[key])
          );
        }
      } else if (typeof query === "function") {
        results = data[this.name].filter(query);
      } else {
        reject(`Invalid query: ${query}`);
      }

      resolve(results);
    });
  }

  findOne(query = {}) {
    return new Promise((resolve, reject) => {
      this.find(query)
        .then((results) => resolve(results.length ? results[0] : null))
        .catch((error) => reject(error));
    });
  }

  update(query = {}, set) {
    return new Promise((resolve, reject) => {
      let newData = this.data;

      let matches;
      if (typeof query === "object") {
        matches = (document) => Object.keys(query).every((key) => document[key] === query[key]);
      } else if (typeof query === "function") {
        matches = query;
      }

      let updatedDocuments = [];
      newData[this.name] = newData[this.name].map((document) => {
        if (matches(document)) {
          const updatedDocument = { ...document, ...set };
          updatedDocuments.push(updatedDocument);
          return updatedDocument;
        }
        return document;
      });

      this.data = newData;
      resolve(updatedDocuments);
    });
  }

  delete(query = {}) {
    return new Promise((resolve, reject) => {
      let newData = this.data;

      let toDelete = [];
      if (typeof query === "object") {
        if (Object.keys(query).length === 0) {
          toDelete = newData[this.name];
        } else {
          toDelete = newData[this.name].filter((document) =>
            Object.keys(query).every((key) => document[key] === query[key])
          );
        }
      } else if (typeof query === "function") {
        toDelete = newData[this.name].filter(query);
      } else {
        reject(`Invalid query: ${query}`);
      }

      newData[this.name] = newData[this.name].filter((document) => !toDelete.includes(document));

      this.data = newData;
      resolve(toDelete);
    });
  }

  clear() {
    return this.delete({});
  }

  drop() {
    return new Promise((resolve, reject) => {
      this.clear()
        .then(() => {
          try {
            fs.unlinkSync(this.filepath);
            this.filepath = null;
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .catch((error) => reject(error));
    });
  }
}
