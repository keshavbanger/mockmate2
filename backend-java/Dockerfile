# Build stage
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
# Copy the pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B
# Copy the source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# Run stage
# Needs the full JDK, not just the JRE: InAppExecutionProvider (the code-
# execution fallback used when no external sandbox provider is configured)
# calls ToolProvider.getSystemJavaCompiler(), which is only present in a
# JDK — on a JRE it returns null and the single-file-source-launch fallback
# also fails (same "jdk.compiler not in boot layer" error either way, since
# `java Foo.java` needs the compiler module internally too).
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Expose port 8080
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
