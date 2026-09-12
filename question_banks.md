# Question Banks

This document contains standardized, vetted interview question banks for Kramix AI across supported domains and competencies.

---

## Core Java

Core Java fundamentals only. Frameworks, enterprise libraries, and persistence layers (such as Spring, Spring Boot, Hibernate, JPA, JDBC, Servlets, JSP, and Java EE / Jakarta EE) are strictly excluded from this bank.

### Core Java — 10 Questions

### Q1. What is Java?

**Answer:**
Java is a high-level, object-oriented, class-based programming language designed to be platform independent. Java code is compiled into bytecode, which can run on any system having a compatible JVM.

---

### Q2. What is the difference between JDK, JRE, and JVM?

**Answer:**

* **JVM (Java Virtual Machine):** Executes Java bytecode.
* **JRE (Java Runtime Environment):** Contains the JVM and libraries required to run Java applications.
* **JDK (Java Development Kit):** Contains the JRE plus development tools such as the Java compiler (`javac`).

Simple hierarchy:

`JDK → JRE → JVM`

---

### Q3. What are the main features of Java?

**Answer:**
Important features of Java include:

* Object-oriented
* Platform independent
* Portable
* Robust
* Secure
* Multithreaded
* Automatic garbage collection
* High performance through JIT compilation

---

### Q4. What is a class and what is an object in Java?

**Answer:**
A **class** is a blueprint that defines properties and behaviors.

An **object** is an actual instance of a class.

Example:

```java
class Car {
    String color;
}

Car c1 = new Car();
```

Here, `Car` is the class and `c1` is an object.

---

### Q5. What are the four pillars of OOP in Java?

**Answer:**
The four main pillars of Object-Oriented Programming are:

1. **Encapsulation** — wrapping data and methods together.
2. **Inheritance** — acquiring properties and behavior from another class.
3. **Polymorphism** — one interface/name having multiple forms.
4. **Abstraction** — hiding implementation details and showing essential functionality.

---

### Q6. What is the difference between `==` and `.equals()` in Java?

**Answer:**
`==` compares primitive values directly, but for objects it generally compares whether two references point to the same object.

`.equals()` is used to compare object contents when the class provides an appropriate implementation.

Example:

```java
String a = new String("Java");
String b = new String("Java");

a == b        // false
a.equals(b)   // true
```

---

### Q7. What is method overloading in Java?

**Answer:**
Method overloading means having multiple methods with the same name but different parameter lists in the same class.

Example:

```java
void add(int a, int b) {
}

void add(int a, int b, int c) {
}
```

It is an example of compile-time polymorphism.

---

### Q8. What is method overriding in Java?

**Answer:**
Method overriding occurs when a child class provides its own implementation of a method already defined in its parent class.

Example:

```java
class Animal {
    void sound() {
        System.out.println("Animal sound");
    }
}

class Dog extends Animal {
    @Override
    void sound() {
        System.out.println("Bark");
    }
}
```

It is associated with runtime polymorphism.

---

### Q9. What is the difference between an interface and an abstract class?

**Answer:**
An **abstract class** can contain abstract methods as well as concrete methods and can have instance variables and constructors.

An **interface** defines a contract that classes can implement. Modern Java interfaces can also contain default and static methods.

A class can implement multiple interfaces, while Java allows a class to extend only one class.

---

### Q10. What is garbage collection in Java?

**Answer:**
Garbage collection is Java's automatic memory-management mechanism.

The JVM identifies objects that are no longer reachable and can reclaim their memory automatically.

This reduces the need for programmers to manually free memory.
