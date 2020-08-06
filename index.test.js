const db = require("./index");

describe("tests database at default path", () => {
  let collection = db.collection("testCollection");

  test("creates or reads database", () => {
    expect(collection.filepath).not.toBeNull();
  });

  test("clears database", async () => {
    await collection.clear();
    const result = await collection.find();
    expect(result).toHaveLength(0);
  });

  test("inserts single document", async () => {
    collection.insert({ name: "foo", value: 42 });
    const result = await collection.find();
    expect(result).toHaveLength(1);
  });

  test("inserts multiple documents", async () => {
    collection.insert([
      { name: "bar", value: 999, multiple: true },
      { name: "baz", value: -1, multiple: true },
    ]);
    const result = await collection.find();
    expect(result).toHaveLength(3);
  });

  test("doesn't insert invalid documents", async () => {
    const error = "Trying to insert invalid document";
    expect(collection.insert(null)).rejects.toContain(error);
    expect(collection.insert([1, 2, 3])).rejects.toContain(error);
    expect(collection.insert(() => 1 + 2)).rejects.toContain(error);
  });

  test("finds single documents by query", async () => {
    const result = await collection.findOne({ name: "foo" });
    expect(result.value).toBe(42);
  });

  test("finds multiple documents by query", async () => {
    const result = await collection.find({ multiple: true });
    expect(result).toHaveLength(2);
  });

  test("finds multiple documents by filter", async () => {
    const result = await collection.find((doc) => doc.name.startsWith("ba"));
    expect(result).toHaveLength(2);
  });

  test("updates documents by query", async () => {
    const result = await collection.update({ multiple: true }, { multiple: false });
    expect(result).toHaveLength(2);
    expect(result[0].multiple).toBe(false);
    expect(result[1].multiple).toBe(false);
  });

  test("updates documents by filter", async () => {
    const result = await collection.update((doc) => doc.value < 0, { value: 1, special: true });
    expect(result[0].value).toBe(1);
    const search = await collection.find({ special: true });
    expect(search[0].value).toBe(1);
  });

  test("removes single document", async () => {
    await collection.delete({ name: "bar" });
    const result = await collection.find();
    expect(result).toHaveLength(2);
  });
});

describe("tests database at specific path", () => {
  let absCollection = db.collection("absolutePathCollection", "./temp/absolutePathCollection.json");
  test("creates database at specific path", () => {
    expect(absCollection.filepath).not.toBeNull();
  });

  test("drops database", async () => {
    await absCollection.drop();
    expect(absCollection.filepath).toBeNull();
  });
});
