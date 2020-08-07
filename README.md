# minim-json-db

A minimal, lightweight NoSQL database implementation for node.js / electron apps which stores data locally in .json files with a simple MongoDB-inspired API

## Usage

```js
import db from "minim-json-db"

const collection = db.collection("things")
```
The default module export provides a single `collection(name, [path])` method which takes the name of the collection and creates a `.json` file locally to store the collection's documents in. By default the file is created in:
- `C:\Users\{user}\AppData\Roaming\{application name}\{collection name}.json` on Windows
- `{home}\Library\Application Support\{application name}\{collection name}.json` on Mac
- `\var\local\{application name}\{collection name}.json` on Linux
  
The `application name` is inferred from the `name` field in your `package.json`.

Alternatively, you can pass a second optional argument to the method to create the `.json` file at a specific path - E.g. `db.collection("things", "C:/App/stuff.json")`

If the file already exists, the collection will be initialised using the data from the existing file. 

Returns a `Collection` object which supports the following methods: 

### `collection.insert(object)`
Adds the javascript object `object` to the collection. If the object provided does not have an `id` field, it will be automtically added by generating an univeral unique identifier before insert. The function accepts an array of objects as well, in which case all the objects in the array will be inserted in the collection. Returns a promise for an array containing all the successfully inserted documents.

### `collection.find(query)`
Finds and returns all the documents in the collection that match the provided `query`. A query can be of two types:

- An **object** will return all documents whose properties match the query object exactly. E.g. `collection.find({ age: 18 })` will return all documents with a `age` field with an exact value of 18
- A **function** will be used to [filter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter) through all the elements in the collection and return all documents which pass the test implemented by the function. E.g. `collection.find((doc) => doc.age > 18)` will return all document with an `age` field which is larger than 18.

Returns a promise for an array with the results (or an empty one if no results were found). Omit `query` to fetch all documents in the collection.

### `collection.findOne(query)`
Like `find()`, but returns a promise of a single object (or `null` if none is found).

### `collection.update(query, set)`
Updates all documents in the collection that match the provided `query` with the provided `set` of data. The data is applied on top of the old object - any new field will be added, and any existing field will be updated. Returns a promise for an array containing all the successfully updated documents.

### `collection.remove(query)`
Deletes all documents in the collection that match the provided `query`. Returns a promise for an array containing all the successfully deleted documents.

### `collection.clear()`
Deletes all documents in the collection. Equivalent to calling `collection.remove({})`.

### `collection.drop()`
Like `clear()`, but will also delete the `.json` file that was used by the collection.

### `collection.sync()`
Makes sure that the collection's internal data matches the data on the .json file stored on disk. You shouldn't need to call this.

---

Note that as all collection methods return promises they should be used asynchronously:
```js
collection.find().then(results => /* do something with the results */);
// or, in an async function:
const results = await collection.find();
```