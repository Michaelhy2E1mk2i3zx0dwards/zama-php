# README.md

# Zama FHE PHP SDK

## Overview

Zama FHE PHP SDK is a PHP library designed to bring Fully Homomorphic Encryption (FHE) capabilities to the world's largest web development ecosystem. With this SDK, developers building applications in PHP, WordPress, Laravel, Symfony, or other frameworks can perform computations on encrypted data without ever decrypting it. This unlocks a new paradigm of privacy-preserving web applications where sensitive data can remain confidential while still being processed programmatically.

Fully Homomorphic Encryption allows computations over encrypted data, making it possible to execute operations such as sums, multiplications, and logical transformations while preserving the privacy of the underlying data. Zama FHE PHP SDK simplifies these advanced cryptographic operations into PHP-friendly APIs, abstracting away the complexities of cryptography and Rust internals, allowing developers to focus on building secure, privacy-first applications.

## Why FHE Matters for PHP Developers

In modern web applications, data privacy is a pressing concern. Traditional encryption methods protect data at rest and in transit, but require decryption to perform computations. This creates attack surfaces and compliance challenges. FHE resolves this by allowing direct computations on encrypted data:

* Protect user data from database leaks.
* Enable cloud processing without exposing sensitive information.
* Maintain compliance with privacy regulations while performing analytics.
* Support multi-tenant SaaS applications with secure, isolated computations.

By integrating FHE into PHP, Zama FHE PHP SDK provides developers with tools to handle sensitive data safely without compromising functionality or user experience.

## Features

* **PHP-Friendly API:** Simple, idiomatic PHP functions for encryption, decryption, and arithmetic operations.
* **FFI Integration:** Encapsulates the power of `TFHE-rs` via PHP Foreign Function Interface (FFI) without requiring deep Rust knowledge.
* **Framework Examples:** Ready-to-use integration examples for Laravel and Symfony.
* **Documentation & Tutorials:** Step-by-step guides to get started quickly, including examples for common web development scenarios.
* **Secure by Design:** Core cryptographic operations performed in Rust ensure safety and efficiency.
* **Composable Operations:** Supports complex homomorphic computations through a combination of basic arithmetic and logical operations.

## Installation

Install via Composer:

```
composer require zama/zama-php
```

Ensure your PHP environment supports FFI and that required Rust libraries are accessible. Detailed setup instructions are included in the SDK documentation.

## Quick Start

### Encrypting Data

```php
use Zama\FHE\Encoder;

$encoder = new Encoder();
$encrypted = $encoder->encryptInt(42);
```

### Performing Computations

```php
$result = $encrypted->add($encrypted2);
$result = $result->multiply($encrypted3);
```

### Decrypting Results

```php
$plain = $result->decrypt();
echo "Result: " . $plain;
```

### Integration with Laravel

```php
use App\Services\FHEService;

$fheService = new FHEService();
$secureValue = $fheService->encrypt(100);
$processed = $fheService->process($secureValue);
echo $fheService->decrypt($processed);
```

This demonstrates how Zama FHE PHP SDK can fit seamlessly into a modern web application stack.

## Architecture

* **PHP Layer:** Provides a developer-friendly interface with type-safe operations and error handling.
* **FFI Bridge:** Connects PHP code to high-performance Rust implementations of FHE primitives.
* **Rust Core (`TFHE-rs`):** Performs actual homomorphic encryption computations securely and efficiently.
* **Framework Integration Modules:** Provide helpers for Laravel, Symfony, and other popular frameworks, making integration straightforward.

## Security Considerations

* **Memory Safety:** Cryptographic computations occur in Rust, reducing risks of memory corruption.
* **Key Management:** SDK provides interfaces for secure key generation and storage.
* **Side-Channel Resistance:** Core algorithms are designed to mitigate timing and other side-channel attacks.
* **Data Isolation:** Encrypted data never leaves the PHP runtime in plaintext form during computations.

## Use Cases

* Privacy-preserving analytics on sensitive user data.
* Encrypted form submissions and computations in web applications.
* Secure multi-party computations in SaaS platforms.
* Cloud services that operate on encrypted datasets without needing decryption.

## Performance Notes

While FHE introduces computational overhead compared to plaintext operations, the SDK is optimized for web use cases. Rust-powered computations are highly efficient, and PHP FFI allows minimal performance penalties when bridging between PHP and Rust.

## Tutorials

* Encrypting sensitive user data in Laravel forms.
* Performing homomorphic calculations in Symfony services.
* Batch processing encrypted records without exposing plaintext.
* Implementing a privacy-first analytics dashboard.

## Roadmap

* Extended support for floating-point operations.
* Optimizations for large-scale batch encryption/decryption.
* Enhanced integration examples for WordPress plugins.
* Advanced tutorials for multi-tenant applications using homomorphic encryption.
* Developer tooling for key rotation and audit logging.

## Contribution

Zama FHE PHP SDK welcomes contributions from developers interested in privacy-preserving technologies, PHP security, or cryptography. The SDK is modular, making it easy to extend, test, and integrate into existing projects.

## License

Distributed under a permissive license allowing both commercial and non-commercial use. See LICENSE file for full details.
