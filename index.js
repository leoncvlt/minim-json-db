const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const getAppName = () => {
  try {
    const app = require(__dirname + "/package.json");
    return app.name;
  } catch (error) {}

  try {
    const { app } = require("electron");
    return app.getName();
  } catch (error) {}

  return undefined;
};

const getDatabasePath = (fallbackName) => {
  let appName = getAppName();
  if (!appName) {
    console.warn(
      `Could not extract app name from package.json or electron data.` +
        `Using the collection name ${fallbackName} as fallback value to create database filepath.`
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
    if (fs.existsSync(filepath)) {
      console.log(`Found existing database table at ${filepath}`);
      this.filepath = filepath;
    } else {
      try {
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify({ [this.name]: [] }, null, 2));
        console.log(`Created database table at ${filepath}`);
        this.filepath = filepath;
      } catch (error) {
        throw new Error(`Could not create database table at ${filepath}: ${error}`);
      }
    }
  }

  insert(document) {
    return new Promise((resolve, reject) => {
      if (this.filepath && fs.existsSync(this.filepath)) {
        let data = JSON.parse(fs.readFileSync(this.filepath));

        const _insert = (document) => {
          if (!document || typeof document !== "object") {
            reject(`Trying to insert invalid document: ${document}`);
            return;
          }
          if (!("id" in document)) {
            let id = crypto.randomBytes(16).toString("hex");
            document["id"] = id;
          }
          data[this.name].push(document);
        };

        if (Array.isArray(document)) {
          document.forEach((d) => _insert(d));
        } else {
          _insert(document);
        }

        try {
          fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
          resolve(document);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(`No database file for ${this.name} collection found.`);
      }
    });
  }

  find(query = {}) {
    return new Promise((resolve, reject) => {
      if (this.filepath && fs.existsSync(this.filepath)) {
        const data = JSON.parse(fs.readFileSync(this.filepath));

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
      } else {
        reject(`No database file for ${this.name} collection found.`);
      }
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
      if (fs.existsSync(this.filepath)) {
        let data = JSON.parse(fs.readFileSync(this.filepath));

        let matches;
        if (typeof query === "object") {
          matches = (document) => Object.keys(query).every((key) => document[key] === query[key]);
        } else if (typeof query === "function") {
          matches = query;
        }

        let updatedDocuments = [];
        data[this.name] = data[this.name].map((document) => {
          if (matches(document)) {
            const updatedDocument = { ...document, ...set };
            updatedDocuments.push(updatedDocument);
            return updatedDocument;
          }
          return document;
        });

        try {
          fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
          resolve(updatedDocuments);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(`No database file for ${this.name} collection found.`);
      }
    });
  }

  delete(query = {}) {
    return new Promise((resolve, reject) => {
      if (this.filepath && fs.existsSync(this.filepath)) {
        let data = JSON.parse(fs.readFileSync(this.filepath));

        let toDelete = [];
        if (typeof query === "object") {
          if (Object.keys(query).length === 0) {
            toDelete = data[this.name];
          } else {
            toDelete = data[this.name].filter((document) =>
              Object.keys(query).every((key) => document[key] === query[key])
            );
          }
        } else if (typeof query === "function") {
          toDelete = data[this.name].filter(query);
        } else {
          reject(`Invalid query: ${query}`);
        }

        data[this.name] = data[this.name].filter((document) => !toDelete.includes(document));

        try {
          fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
          resolve(toDelete);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(`No database file for ${this.name} collection found.`);
      }
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
