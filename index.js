import express from "express";
import jwt from "express-jwt";

import { GRPC as Cerbos } from "@cerbos/grpc";
import db from "./db.js";

const cerbos = new Cerbos("localhost:3593", { tls: false });

const app = express();
const checkJwt = jwt({ secret: "yoursecret", algorithms: ["HS256"] });

// Extract data from the JWT (check DB etc) and create the principal object to be sent to Cerbos
const jwtToPrincipal = ({ id, roles = [], ...rest }) => {
  return {
    id: id,
    roles,
    attributes: rest,
  };
};

// Example JWT:
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1NjdVVUlEZnJvbWdyYXBoIiwibmFtZSI6IkNvbnJhZCIsImFjY291bnRfaWQiOiIqIiwiY29udGVudF90eXBlIjoiZGlnaXRhbF9hdWRpbyIsInJvbGVzIjpbIkNvbnRlbnRQcm9maWxlX2Rpc3RyaWJ1dGlvbl9yZXZpZXdlciJdfQ.ovu67X2OxYcYado6agdKdA6JbSCaw2F4upM06CLSH7w

// Example output from jwtToPrincipal:
// {
//   id: '1234567UUIDfromgraph',
//   roles: [ 'ContentProfile_distribution_reviewer' ],
//   attributes: { name: 'Conrad', account_id: '*', content_type: 'digital_audio' }
// }

// READ
app.get("/contacts/:id", checkJwt, async (req, res) => {
  // load the contact
  const contact = db.findOne(req.params.id);
  if (!contact) {
    return res.status(404).json({ error: "Contact not found" });
  }

  // check user is authorized
  const decision = await cerbos.checkResource({
    principal: jwtToPrincipal(req.user),
    resource: {
      kind: "contact",
      id: contact.id,
      attributes: contact,
    },
    actions: ["read"],
  });

  // authorized for read action
  if (decision.isAllowed("read")) {
    return res.json(contact);
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// CREATE
app.post("/contacts/new", checkJwt, async (req, res) => {
  // check user is authorized
  const decision = await cerbos.checkResource({
    principal: jwtToPrincipal(req.user),
    resource: {
      kind: "contact",
      id: "new",
    },
    actions: ["create"],
  });

  // authorized for create action
  if (decision.isAllowed("create")) {
    return res.json({ result: "Created contact" });
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// UPDATE
app.patch("/contacts/:id", checkJwt, async (req, res) => {
  const contact = db.findOne(req.params.id);
  if (!contact) {
    return res.status(404).json({ error: "Contact not found" });
  }

  const decision = await cerbos.checkResource({
    principal: jwtToPrincipal(req.user),
    resource: {
      kind: "contact",
      id: contact.id,
      attributes: contact,
    },
    actions: ["update"],
  });

  if (allowed.isAllowed("update")) {
    return res.json({
      result: `Updated contact ${req.params.id}`,
    });
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// DELETE
app.delete("/contacts/:id", checkJwt, async (req, res) => {
  const contact = db.findOne(req.params.id);
  if (!contact) {
    return res.status(404).json({ error: "Contact not found" });
  }

  const decision = await cerbos.checkResource({
    principal: jwtToPrincipal(req.user),
    resource: {
      kind: "contact",
      id: contact.id,
      attributes: contact,
    },
    actions: ["delete"],
  });

  if (decision.isAllowed("delete")) {
    return res.json({
      result: `Contact ${req.params.id} deleted`,
    });
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// LIST
app.get("/contacts", checkJwt, async (req, res) => {
  // load the contacts
  const contacts = db.find(req.params.id);

  // check user is authorized
  const decision = await cerbos.checkResources({
    principal: jwtToPrincipal(req.user),
    resources: contacts.map((contact) => ({
      resource: {
        kind: "contact",
        id: contact.id,
        attributes: contact,
      },
      actions: ["list"],
    })),
  });

  // filter only those authorised
  const result = contacts.filter((c) =>
    decision.isAllowed({
      resource: { kind: "contact", id: c.id },
      action: "list",
    })
  );

  // return the contact
  return res.json(result);
});

app.listen(3000, () => console.log("Listening on port 3000"));
