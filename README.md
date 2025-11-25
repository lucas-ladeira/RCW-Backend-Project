# Blockchain Application for Drug Traceability

This project aims to develop a web and mobile application based on blockchain technology to guarantee the traceability of medicines throughout the supply chain, from the manufacturer to the end consumer. By using smart contracts and AI to detect fraudulent schemes, the application prevents the distribution of counterfeit medicines and offers complete transparency in the pharmaceutical supply chain.

## Problem (WHY):
Counterfeit medicines are a global problem that endangers public health.
The ability to trace the origin and journey of medicines throughout the supply chain is essential to ensure their authenticity and prevent counterfeiting.

## Context (HOW):
The application will allow users to scan QR or RFID codes on medication packaging to verify its origin and distribution history. Blockchain will be used to store each medication transaction or transfer transparently and securely. AI will be integrated to detect abnormal distribution patterns and identify suspicious transactions, such as discrepancies in delivery times or inconsistencies in volumes. A microservices architecture is used to separate the different modules (user management, blockchain transaction management, AI detection, and notifications).

## Development:
- Frontend: React.js for web, React Native for mobile. 
- Backend: Node.js or Python (Flask/Django) for REST APIs.
- Blockchain: Using Ethereum or Hyperledger Fabric for managing supply chain transactions.
- AI/ML: AI models to detect abnormal patterns in transactional data streams.
- Database: SQL (PostgreSQL) for user information and NoSQL (MongoDB) for storing blockchain metadata.
- Versioning: GitHub or GitLab for version control. 
- CI/CD: Automated deployment with GitLab CI or GitHub Actions.
