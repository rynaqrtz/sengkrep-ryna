const INTROSPECTION_QUERY = `query IntrospectionQuery { __schema { queryType { name } types { name kind fields { name type { name kind ofType { name kind } } } } } }`;

class GraphQLClient {
  constructor(ryna) {
    this.ryna = ryna;
  }

  async _post(endpoint, query, variables, headers) {
    const res = await this.ryna._fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
      body:    JSON.stringify({ query, variables }),
    });

    const parsed = JSON.parse(res.body);
    if (parsed.errors && parsed.errors.length > 0) {
      const err  = new Error(parsed.errors.map(e => e.message).join('; '));
      err.name   = 'GraphQLError';
      err.errors = parsed.errors;
      throw err;
    }

    return parsed.data;
  }

  async introspect(endpoint, options = {}) {
    const data = await this._post(endpoint, INTROSPECTION_QUERY, {}, options.headers);
    const schema = data.__schema;

    const types = {};
    for (const type of schema.types) {
      if (!type.fields) continue;
      types[type.name] = {
        kind:   type.kind,
        fields: type.fields.map(f => ({
          name: f.name,
          type: f.type.name ?? f.type.ofType?.name ?? f.type.kind,
        })),
      };
    }

    return { queryType: schema.queryType?.name ?? null, types };
  }

  async query(endpoint, queryString, variables = {}, options = {}) {
    return this._post(endpoint, queryString, variables, options.headers);
  }

  flattenConnection(connectionObj) {
    if (!connectionObj || !Array.isArray(connectionObj.edges)) return [];
    return connectionObj.edges.map(e => e.node);
  }

  async queryAllPages(endpoint, queryString, options = {}) {
    const {
      variables    = {},
      connectionPath,
      maxPages     = 20,
      pageSize     = 50,
      headers,
    } = options;

    const results = [];
    let cursor    = null;
    let hasNext   = true;
    let page      = 0;

    while (hasNext && page < maxPages) {
      const data = await this._post(endpoint, queryString, { ...variables, first: pageSize, after: cursor }, headers);

      let connection = data;
      for (const key of connectionPath.split('.')) connection = connection[key];

      results.push(...this.flattenConnection(connection));

      hasNext = connection.pageInfo?.hasNextPage ?? false;
      cursor  = connection.pageInfo?.endCursor ?? null;
      page++;
    }

    return results;
  }
}

module.exports = GraphQLClient;
